/* global innerWidth, scrollTo */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { testServer, client } from './test-support.mjs';

process.env.BACKUP_ENABLED = 'false';
const server = await testServer('facility_effects', 3048), api = client(server.origin), neutralApi = client(server.origin);
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const password = 'Facility-effects-test-42!', passed = [], errors = [], throttled = [], artifacts = 'artifacts/facility-effects';
fs.mkdirSync(artifacts, { recursive: true });
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() === 429) throttled.push(response.url()); });
const check = name => { passed.push(name); console.log('PASS ' + name); };
const textState = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const button = name => page.getByRole('button', { name, exact: true }).first();
const trigger = id => page.locator(`.facility-effects-trigger[data-effects-for="${id}"]`);
const effects = id => page.locator(`#facility-effects-${id}`);
const closeEnough = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${expected}; received ${actual}`);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Unexpected horizontal page overflow');
const shot = async name => { await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true, animations: 'disabled' }); };
const changed = async operation => { const revision = (await textState()).revision; await operation(); await page.waitForFunction(rev => JSON.parse(window.render_game_to_text()).revision > rev && !JSON.parse(window.render_game_to_text()).busy, revision); };
const chooseTheme = async (name, id) => {
  await button('Choose theme').click();
  await page.getByRole('dialog', { name: 'Appearance', exact: true }).getByRole('radio', { name, exact: true }).locator('..').click();
  await button('Done').click();
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, id);
};
const login = async username => {
  await page.goto(server.origin);
  await button('Sign in').click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await button('Return to corporation').click();
  await page.getByText('Corporation overview', { exact: true }).waitFor();
  await button('Facilities').click();
};
try {
  const content = await (await fetch(server.origin + '/api/content')).json();
  for (const [who, username] of [[api, 'effects_owner'], [neutralApi, 'effects_neutral']]) assert.equal((await who.request('/api/auth/register', { username, password, name: username })).status, 200);
  const ownerId = (await api.state()).corporation.id, neutralId = (await neutralApi.state()).corporation.id;
  await server.stop();
  const now = Date.now(), owner = (await server.query('SELECT state FROM corporations WHERE id=$1', [ownerId])).rows[0].state;
  const neutral = (await server.query('SELECT state FROM corporations WHERE id=$1', [neutralId])).rows[0].state;
  const world = (await server.query('SELECT state FROM world WHERE id=1')).rows[0].state;
  const facility = (type, overrides = {}) => {
    const def = content.facilities.find(item => item.id === type);
    assert.ok(def, `Unknown fixture facility ${type}`);
    return { id: randomUUID(), type, level: 0, xp: 0, nextCycle: now + 3600000, enabled: true, plus: true, allowPlus: false, installed: [], costPaid: def.cost, materialsPaid: def.materials, builtAt: now, ...overrides };
  };
  const oil = facility('oil_well'), oilHost = facility('oil_well', { installed: ['oil_mapping', 'oil_specialization'] }), oilPaused = facility('oil_well', { enabled: false });
  const tree = facility('tree_farm'), treePaused = facility('tree_farm', { enabled: false }), starved = facility('steel_mill'), capacity = facility('coal_mine');
  const research = facility('research_facility'), logistics = facility('logistics_center'), baselineOil = facility('oil_well'), plain = facility('steel_mill');
  for (const region of world.regions) {
    region.happiness = region.id === 'verdant' ? 60 : 50;
    region.modifiers = Object.fromEntries(Object.keys(region.modifiers).map(key => [key, 1]));
    if (['verdant', 'ironridge'].includes(region.id)) region.modifiers.oil = 0.9;
    region.policies = []; region.services = {}; region.projectBenefits = []; region.projectHappiness = 0;
    region.nextUpdate = now + 3600000;
  }
  owner.cash = 5000000000; owner.entitlement = 'free'; owner.rewards = { vote: now }; owner.lastProcessed = now;
  owner.holdings.verdant.land = 100;
  owner.holdings.verdant.inventory = { coal: 9000000000000, scrap: 100 };
  owner.holdings.verdant.facilities = [oil, oilHost, oilPaused, tree, treePaused, starved, capacity, research, logistics];
  owner.holdings.ironridge.land = 10; owner.holdings.ironridge.facilities = [baselineOil];
  neutral.cash = 1000000000; neutral.entitlement = 'free'; neutral.rewards = { vote: now - content.rules.vote.boonSeconds * 1000 - 60000 }; neutral.lastProcessed = now;
  neutral.holdings.ironridge.land = 10; neutral.holdings.ironridge.inventory = { iron: 100, coal: 100 }; neutral.holdings.ironridge.facilities = [plain];
  await server.query('UPDATE corporations SET state=$1 WHERE id=$2', [JSON.stringify(owner), ownerId]);
  await server.query('UPDATE corporations SET state=$1 WHERE id=$2', [JSON.stringify(neutral), neutralId]);
  await server.query('UPDATE world SET state=$1 WHERE id=1', [JSON.stringify(world)]);
  await server.start();

  const snapshot = await api.state(), facilities = snapshot.holdings.verdant.facilities, find = id => facilities.find(item => item.id === id);
  const oilState = find(oil.id), basic = snapshot.holdings.ironridge.facilities[0];
  assert.equal(basic.cycleSeconds, 8.889); assert.equal(oilState.cycleSeconds, 8.715);
  assert.equal(oilState.effects.cycle.baseSeconds, 10); assert.equal(oilState.effects.cycle.adjustedSeconds, 10);
  closeEnough(basic.effects.cycle.speedMultiplier, 0.9 * 1.25);
  closeEnough(oilState.effects.cycle.speedMultiplier, 0.9 * 1.25 * 1.02);
  assert.equal(oilState.effects.cycle.effectiveSeconds, oilState.cycleSeconds);
  assert.equal(oilState.effects.cycle.floorApplied, false);
  assert.ok(oilState.effects.entries.some(entry => entry.id === 'regional-roll' && entry.tone === 'negative'));
  assert.ok(oilState.effects.entries.some(entry => entry.id === 'happiness' && entry.tone === 'positive'));
  const supporter = oilState.effects.entries.find(entry => entry.id === 'supporter-boon');
  assert.equal(supporter.expiresAt, now + content.rules.vote.boonSeconds * 1000);
  assert.ok(!basic.effects.entries.some(entry => entry.id === 'happiness'));
  check('Authoritative effects explain 10s oil cycles becoming 8.889s with the regional penalty and supporter boon, then 8.715s at 60 happiness');

  const technologies = oilState.effects.entries.filter(entry => entry.id.startsWith(`technology:${oilHost.id}:`));
  assert.ok(technologies.some(entry => entry.category === 'output' && entry.label.includes('Oil mapping')));
  assert.ok(technologies.some(entry => entry.category === 'quality' && entry.label.includes('Oil specialization')));
  assert.equal(oilState.installed.length, 0);
  assert.equal(oilState.effectiveLevel, 4);
  closeEnough(oilState.effects.quality.chance, 4 * content.rules.plusChancePerLevel);
  closeEnough(oilState.outputRates.crude_oil * oilState.cycleSeconds / 60, 14);
  check('Output and quality entries include eligible technologies installed on another regional facility and match actual recipe/rates');

  for (const f of facilities) {
    assert.equal(f.effects.positiveCount, f.effects.entries.filter(entry => entry.tone === 'positive').length);
    assert.equal(f.effects.negativeCount, f.effects.entries.filter(entry => entry.tone === 'negative').length);
    for (const entry of f.effects.entries) { assert.ok(entry.label); assert.ok(entry.value); assert.ok(entry.description); assert.ok(entry.scope); }
  }
  for (const [id, status] of [[oilPaused.id, 'paused'], [starved.id, 'starved'], [capacity.id, 'capacity']]) {
    assert.equal(find(id).status, status);
    assert.ok(find(id).effects.entries.some(entry => entry.id === `operation:${status}` && entry.tone === 'negative'));
  }
  for (const id of [research.id, logistics.id]) {
    assert.equal(find(id).status, 'infrastructure');
    assert.equal(find(id).effects.cycle, undefined); assert.equal(find(id).effects.quality, undefined);
    assert.ok(!find(id).effects.entries.some(entry => ['speed', 'cycle', 'quality', 'output'].includes(entry.category)));
  }
  const neutralState = (await neutralApi.state()).holdings.ironridge.facilities[0];
  assert.equal(neutralState.status, 'producing'); assert.deepEqual(neutralState.effects.entries, []);
  assert.equal(neutralState.effects.positiveCount, 0); assert.equal(neutralState.effects.negativeCount, 0);
  check('Counts agree with real sources; neutral production stays unmodified, paused/starved/full facilities show blockers, and infrastructure invents no production buffs');

  await login('effects_owner');
  await trigger('group-oil_well').waitFor();
  assert.match(await trigger('group-oil_well').innerText(), /3 boosted/);
  assert.match(await trigger('group-oil_well').innerText(), /3 penalized/);
  assert.match(await trigger('group-tree_farm').innerText(), /2 boosted/);
  assert.match(await trigger('group-tree_farm').innerText(), /1 penalized/);
  await trigger('group-oil_well').focus(); await page.keyboard.press('Enter');
  await effects(oil.id).waitFor();
  await page.waitForFunction(id => document.activeElement?.id === `facility-effects-${id}`, oil.id);
  assert.equal(await effects(oil.id).evaluate(node => node === document.activeElement), true);
  assert.match(await effects(oil.id).innerText(), /8\.715/);
  assert.match(await effects(oil.id).innerText(), /10/);
  for (const entry of oilState.effects.entries) {
    const direct = effects(oil.id).locator(`[data-effect-id="${entry.id}"]`);
    assert.equal(await direct.count(), 1, `Missing rendered effect ${entry.id}`);
    assert.ok((await direct.innerText()).includes(entry.label));
    assert.ok((await direct.innerText()).includes(entry.value));
  }
  assert.ok(await effects(oil.id).locator('.facility-effect-expiry').count());
  assert.ok((await effects(oil.id).locator('.facility-effect-expiry').first().innerText()).trim());
  assert.equal((await textState()).holding.facilities.find(item => item.id === oil.id).effects.cycle.effectiveSeconds, oilState.cycleSeconds);
  await noOverflow(); await shot('desktop-light');
  check('Group indicators count affected facilities, and keyboard activation reveals focused source details, expiry and base-to-effective cycle math');

  const beforeInspect = await api.state();
  await trigger(oilPaused.id).click();
  await effects(oilPaused.id).waitFor();
  assert.ok((await effects(oilPaused.id).innerText()).includes(find(oilPaused.id).effects.entries.find(entry => entry.id === 'operation:paused').label));
  await trigger('group-tree_farm').click();
  await effects(treePaused.id).waitFor();
  await changed(() => page.locator(`#facility-${treePaused.id}`).getByRole('button', { name: 'Resume', exact: true }).click());
  assert.ok(!(await trigger('group-tree_farm').innerText()).includes('penalized'));
  assert.ok(!(await effects(treePaused.id).innerText()).includes('Paused'));
  await changed(() => page.locator(`#facility-${treePaused.id}`).getByRole('button', { name: 'Pause', exact: true }).click());
  assert.match(await trigger('group-tree_farm').innerText(), /1 penalized/);
  const afterInspect = await api.state();
  assert.equal(afterInspect.corporation.cash, beforeInspect.corporation.cash);
  assert.deepEqual(afterInspect.holdings.verdant.inventory, beforeInspect.holdings.verdant.inventory);
  assert.equal(afterInspect.holdings.verdant.facilities.find(item => item.id === treePaused.id).enabled, false);
  check('Inspecting effects spends nothing, and a real pause/resume action immediately updates both individual and group penalties');

  for (const [name, id] of [['Light', 'light'], ['Dark', 'dark'], ['High Contrast', 'contrast']]) {
    await chooseTheme(name, id);
    await trigger(oil.id).click();
    await effects(oil.id).waitFor();
    await effects(oil.id).screenshot({ path: `${artifacts}/effects-${id}.png`, animations: 'disabled' });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await trigger(oil.id).click();
      await noOverflow();
      await effects(oil.id).screenshot({ path: `${artifacts}/effects-${id}-${width}.png`, animations: 'disabled' });
      assert.ok(await effects(oil.id).getByRole('heading', { name: 'Active effects', exact: true }).isVisible());
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  check('Light, Dark and High Contrast effects remain operable and fit desktop, 390px and 320px mobile widths');

  await chooseTheme('Light', 'light');
  await page.getByLabel('Facility layout', { exact: true }).selectOption('individual');
  await trigger(oil.id).focus(); await page.keyboard.press('Enter');
  await effects(oil.id).waitFor();
  await page.waitForFunction(id => document.activeElement?.id === `facility-effects-${id}`, oil.id);
  assert.equal(await effects(oil.id).evaluate(node => node === document.activeElement), true);
  await button('Overview').click(); await button('Sign out').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'authentication');
  await login('effects_neutral');
  await page.getByLabel('Active region', { exact: true }).selectOption('ironridge');
  await page.getByRole('button', { name: /Your facilities/ }).click();
  await trigger('group-steel_mill').click();
  await effects(plain.id).waitFor();
  assert.match(await trigger(plain.id).innerText(), /No modifiers/);
  assert.equal(await effects(plain.id).locator('.facility-effect-entry').count(), 0);
  await shot('neutral-facility');
  check('Individual layout supports the same keyboard inspection; genuinely neutral facilities show No modifiers');

  if (process.env.WEB_GAME_CLIENT) {
    const result = spawnSync(process.execPath, [process.env.WEB_GAME_CLIENT, '--url', server.origin, '--actions-json', JSON.stringify({ steps: [{ buttons: [], frames: 2 }] }), '--iterations', '1', '--pause-ms', '100', '--screenshot-dir', `${artifacts}/skill-auth`], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    check('Standard develop-web-game client captured authentication; the authenticated workflow covers actual effect controls');
  }
  assert.deepEqual(errors, []); assert.deepEqual(throttled, []);
  check('No browser exceptions or throttled requests');
  fs.writeFileSync(`${artifacts}/report.json`, JSON.stringify({ date: new Date().toISOString(), passed, errors, throttled, fixtureScope: 'Two accounts in an automatically removed isolated PostgreSQL database. Seeded effects are checked against authoritative snapshots and actual production calculations; UI mutations use authenticated actions.' }, null, 2));
} catch (error) {
  await page.evaluate(() => scrollTo(0, 0)).catch(() => {});
  await shot('failure').catch(() => {});
  console.error((await page.locator('body').innerText()).slice(-8000));
  throw error;
} finally { await browser.close(); await server.close(); }
