/* global innerWidth */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { testServer, client } from './test-support.mjs';

process.env.BACKUP_ENABLED = 'false';
const server = await testServer('facility_progression', 3051), api = client(server.origin), peer = client(server.origin);
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
const password = 'Facility-progression-test-42!', username = 'progression_owner', artifacts = 'artifacts/facility-progression';
const passed = [], errors = [], throttled = [], requests = [];
fs.mkdirSync(artifacts, { recursive: true });
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() === 429) throttled.push(response.url()); });
page.on('request', request => { if (new URL(request.url()).pathname === '/api/action') requests.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() }); });
const check = name => { passed.push(name); console.log('PASS ' + name); };
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const button = name => page.getByRole('button', { name, exact: true }).first();
const detail = id => page.locator(`#facility-details-${id}`);
const effects = id => page.locator(`#facility-effects-${id}`);
const progression = id => page.locator(`[data-facility-progression="${id}"]`);
const facility = (snapshot, id, regionId = 'verdant') => snapshot.holdings[regionId].facilities.find(f => f.id === id);
const notes = snapshot => snapshot.notifications.filter(note => note.type === 'facility_level');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `Expected ${expected}; received ${actual}`);
const settled = () => page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).busy);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal page overflow');
const shot = async name => page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true, animations: 'disabled' });
const waitXp = (id, xp) => page.waitForFunction(({ id, xp }) => JSON.parse(window.render_game_to_text()).holding?.facilities.find(f => f.id === id)?.xp === xp, { id, xp });
const open = async (id, type, region = 'verdant') => {
  await page.evaluate(({ id, type, region }) => { window.location.hash = `/facilities?region=${region}&tab=owned&facilityId=${type}&id=${id}`; }, { id, type, region });
  await detail(id).waitFor();
  await page.waitForFunction(id => document.activeElement?.id === `facility-${id}`, id);
};
const login = async name => {
  await page.goto(server.origin + '/#/overview?region=verdant');
  await button('Sign in').click();
  await page.getByLabel('Username', { exact: true }).fill(name);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await button('Return to corporation').click();
  await page.getByText('Corporation overview', { exact: true }).waitFor();
};
const theme = async (name, id) => {
  await button('Choose theme').click();
  await page.getByRole('dialog', { name: 'Appearance', exact: true }).getByRole('radio', { name, exact: true }).locator('..').click();
  await button('Done').click();
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, id);
};
const review = async (id, kind) => {
  await progression(id).getByRole('button', { name: kind === 'next' ? /^Reach next level/ : /^Use available scrap/ }).click();
  return page.getByRole('dialog', { name: kind === 'next' ? 'Reach next level?' : 'Use available scrap?', exact: true });
};
const confirmUpgrade = async (id, expectedXp, expectedSpend, operation) => {
  const before = await api.state();
  const [response] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/action' && response.request().postDataJSON().type === 'facility.addxp'), operation()]);
  assert.equal(response.status(), 200, await response.text());
  const after = await response.json();
  assert.equal(after.facilityUpgrade.spentScrap, expectedSpend);
  assert.equal(facility(after, id).xp, expectedXp);
  assert.equal(after.holdings.verdant.inventory.scrap, before.holdings.verdant.inventory.scrap - expectedSpend);
  await settled(); await waitXp(id, expectedXp);
  return after;
};
let failure;
try {
  const content = await (await fetch(server.origin + '/api/content')).json();
  for (const [who, name] of [[api, username], [peer, 'progression_peer']]) assert.equal((await who.request('/api/auth/register', { username: name, password, name })).status, 200);
  const ownerId = (await api.state()).corporation.id;
  await server.stop();
  const now = Date.now(), owner = (await server.query('SELECT state FROM corporations WHERE id=$1', [ownerId])).rows[0].state;
  const world = (await server.query('SELECT state FROM world WHERE id=1')).rows[0].state;
  const make = (type, overrides = {}) => {
    const def = content.facilities.find(item => item.id === type);
    return { id: randomUUID(), type, level: 0, xp: 0, nextCycle: now + 3600000, enabled: true, plus: true, allowPlus: false, installed: [], costPaid: def.cost, materialsPaid: def.materials, builtAt: now, ...overrides };
  };
  const natural = make('tree_farm', { xp: 99999, nextCycle: now - 1 }), naturalTwo = make('tree_farm', { xp: 199999, level: 1, nextCycle: now - 1 });
  const manual = make('tree_farm', { xp: 99990, enabled: false });
  const capped = make('oil_well', { xp: 4999980, level: 49, enabled: false });
  const oil = make('oil_well'), techHost = make('oil_well', { installed: ['oil_specialization'], enabled: false });
  const starved = make('steel_mill'), starvedTwo = make('steel_mill'), capacity = make('coal_mine'), infrastructure = make('research_facility');
  const retry = make('iron_mine', { xp: 99900, enabled: false }), stale = make('bauxite_mine', { xp: 99950, enabled: false });
  owner.cash = 5000000000; owner.entitlement = 'free'; owner.rewards = { vote: now }; owner.lastProcessed = now - 2;
  owner.holdings.verdant.land = 100; owner.holdings.verdant.inventory = { scrap: 350630, coal: 9000000000000, lamp: 1000 };
  owner.holdings.verdant.facilities = [natural, naturalTwo, manual, capped, oil, techHost, starved, starvedTwo, capacity, infrastructure, retry, stale];
  owner.holdings.ironridge.land = 1;
  for (const region of world.regions) {
    region.happiness = 60; region.modifiers = Object.fromEntries(Object.keys(region.modifiers).map(key => [key, 1]));
    region.modifiers.oil = 0.9; region.policies = []; region.services = {}; region.projectBenefits = []; region.projectHappiness = 0; region.nextUpdate = now + 3600000;
  }
  await server.query('UPDATE corporations SET state=$1 WHERE id=$2', [JSON.stringify(owner), ownerId]);
  await server.query('UPDATE world SET state=$1 WHERE id=1', [JSON.stringify(world)]);
  await server.start();
  const initial = await api.state();
  assert.equal(facility(initial, natural.id).xp, 100000); assert.equal(facility(initial, natural.id).level, 1);
  assert.equal(facility(initial, naturalTwo.id).xp, 200000); assert.equal(facility(initial, naturalTwo.id).level, 2);
  const productionNote = notes(initial).find(note => note.source === 'production');
  assert.ok(productionNote); assert.equal(productionNote.regionId, 'verdant'); assert.equal(productionNote.changes.length, 2);
  assert.deepEqual(new Set(productionNote.facilityIds), new Set([natural.id, naturalTwo.id]));
  assert.equal(productionNote.changes.find(change => change.id === natural.id).fromLevel, 0);
  assert.equal(productionNote.changes.find(change => change.id === natural.id).toLevel, 1);
  assert.equal((await api.action('facility.batch', 'verdant', { ids: [natural.id, naturalTwo.id], enabled: false })).status, 200);
  assert.deepEqual(notes(await api.state()).map(note => note.id), notes(initial).map(note => note.id));
  check('Successful production crosses 99,999→100,000 XP, groups two regional level-ups into one durable event, and repeated snapshots add no duplicate');

  const snapshot = await api.state(), p = facility(snapshot, oil.id).progression;
  assert.equal(p.xpPerLevel, 100000); assert.equal(p.maxLevel, 50); assert.equal(p.status, 'producing'); assert.ok(p.etaSeconds > 0);
  assert.equal(p.xpToNextLevel, 100000); assert.equal(p.quality.effectiveLevel, 4);
  near(p.quality.chance, 4 * content.rules.plusChancePerLevel); near(p.quality.nextLevelChance, 5 * content.rules.plusChancePerLevel);
  near(p.upgrades.next.qualityChance, p.quality.nextLevelChance);
  assert.equal(facility(snapshot, oil.id).cycleSeconds, 8.715);
  assert.equal(p.etaSeconds, Math.ceil((Math.max(0, facility(snapshot, oil.id).nextCycle - snapshot.serverTime) + (Math.ceil(p.xpToNextLevel / p.xpPerCycle) - 1) * 8715) / 1000));
  for (const [f, expected] of [[manual, 'paused'], [starved, 'starved'], [capacity, 'capacity'], [infrastructure, 'infrastructure']]) {
    const current = facility(snapshot, f.id).progression;
    assert.equal(current.status, expected); assert.equal(current.etaSeconds, null); assert.ok(current.etaNote);
  }
  assert.equal(facility(snapshot, infrastructure.id).progression.xpPerCycle, 0);
  assert.equal(facility(snapshot, infrastructure.id).progression.quality.eligible, false);
  check('Authoritative progression uses actual quality technology and cycle modifiers; paused, starved, full and infrastructure facilities have truthful unavailable ETAs');

  await login(username);
  await button('Open notifications').click();
  const groupedAlert = page.locator('[data-production-alert="verdant:steel_mill:starved"]');
  assert.equal(await groupedAlert.count(), 1); assert.match(await groupedAlert.innerText(), /2 × Steel mill/);
  await groupedAlert.getByRole('button', { name: 'Review Iron supply', exact: true }).click();
  await page.getByRole('dialog', { name: 'Iron', exact: true }).waitFor();
  assert.equal((await state()).screen, 'inventory'); assert.equal((await state()).regionId, 'verdant');
  await page.getByRole('dialog', { name: 'Iron', exact: true }).getByRole('button', { name: 'Done', exact: true }).click();
  await button('Overview').click();
  await page.getByLabel('Active region', { exact: true }).selectOption('ironridge');
  await button('Open notifications').click();
  await groupedAlert.getByRole('button', { name: 'Review Iron market', exact: true }).click();
  const ironRow = page.locator('[data-market-resource="iron"]');
  await ironRow.getByLabel('Trade quantity', { exact: true }).waitFor();
  assert.equal((await state()).screen, 'market'); assert.equal((await state()).regionId, 'verdant');
  assert.equal(await ironRow.getByRole('button', { name: 'Trade Iron', exact: true }).getAttribute('aria-expanded'), 'true');
  await button('Open notifications').click(); await page.getByRole('button', { name: /^Events / }).click();
  const productionEvent = page.locator('[data-notification-type="facility_level"]').filter({ hasText: productionNote.title });
  assert.equal(await productionEvent.count(), 1);
  await productionEvent.locator('summary').filter({ hasText: 'Inspect 2 leveled facilities' }).click();
  await productionEvent.getByRole('button', { name: new RegExp(`^Tree farm #${natural.id.slice(0, 8)}`) }).click();
  await detail(natural.id).waitFor(); await settled();
  assert.equal((await state()).regionId, 'verdant');
  assert.equal(notes(await api.state()).find(note => note.id === productionNote.id).read, true);
  check('Grouped blockers link to the correct regional supply and market, while a grouped durable level event opens the selected facility and becomes read');
  await open(manual.id, manual.type);

  assert.equal(await progression(manual.id).getByRole('progressbar').getAttribute('aria-valuetext'), '99,990 of 100,000 XP; 10 XP to level 1');
  const nextDialog = await review(manual.id, 'next');
  assert.match(await nextDialog.innerText(), /100,000/); assert.match(await nextDialog.innerText(), /10/);
  const next = await confirmUpgrade(manual.id, 100000, 10, () => nextDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click());
  assert.equal(notes(next).filter(note => note.source === 'scrap' && note.facilityIds.includes(manual.id)).length, 1);
  await open(capped.id, capped.type);
  const capDialog = await review(capped.id, 'available');
  assert.match(await capDialog.innerText(), /5,000,000/);
  await confirmUpgrade(capped.id, 5000000, 20, () => capDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click());
  assert.equal(await progression(capped.id).getByRole('button', { name: /^Reach next level/ }).isDisabled(), true);
  assert.equal(await progression(capped.id).getByRole('button', { name: /^Use available scrap/ }).isDisabled(), true);
  assert.match(await progression(capped.id).innerText(), /maximum/);
  await open(manual.id, manual.type);
  const allDialog = await review(manual.id, 'available');
  const all = await confirmUpgrade(manual.id, 450600, 350600, () => allDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click());
  assert.equal(all.holdings.verdant.inventory.scrap, 0);
  const multi = notes(all).find(note => note.source === 'scrap' && note.changes.some(change => change.id === manual.id && change.toLevel === 4));
  assert.equal(multi.changes[0].levelsGained, 3); assert.equal(multi.changes[0].fromLevel, 1);
  assert.deepEqual(notes(await api.state()).map(note => note.id), notes(all).map(note => note.id));
  check('Confirmed next-level and available-scrap upgrades spend exact amounts, stop at level 50, and record a three-level upgrade once');

  assert.equal((await api.action('inventory.scrap', 'verdant', { assetId: 'lamp', quantity: 500 })).status, 200);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).holding.inventory.scrap === 500);
  await open(retry.id, retry.type);
  const frozenDialog = await review(retry.id, 'next');
  assert.equal((await api.action('facility.addxp', 'verdant', { id: retry.id, quantity: 40 })).status, 200);
  await waitXp(retry.id, 99940);
  assert.match(await frozenDialog.innerText(), /100,000/);
  const reduced = await confirmUpgrade(retry.id, 100000, 60, () => frozenDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click());
  assert.equal(reduced.holdings.verdant.inventory.scrap, 400);
  const frozenRequest = requests.filter(request => request.body.type === 'facility.addxp').at(-1);
  assert.equal(frozenRequest.body.targetXp, 100000); assert.equal(frozenRequest.body.maxScrap, 100);
  await open(stale.id, stale.type);
  const staleDialog = await review(stale.id, 'next');
  assert.equal((await api.action('facility.addxp', 'verdant', { id: stale.id, quantity: 50 })).status, 200);
  await waitXp(stale.id, 100000);
  const [rejected] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/action' && response.request().postDataJSON().type === 'facility.addxp'), staleDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click()]);
  assert.equal(rejected.status(), 400); await settled();
  assert.equal((await api.state()).holdings.verdant.inventory.scrap, 350);
  assert.match(await staleDialog.innerText(), /Upgrade not completed/);
  await staleDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  check('A reviewed target survives polling: progress reduces the actual cost, while an already reached target rejects safely without spending');

  await open(retry.id, retry.type);
  const uncertainDialog = await review(retry.id, 'available');
  let injected = false;
  await page.route('**/api/action', async route => {
    if (!injected && route.request().postDataJSON().type === 'facility.addxp') {
      injected = true; const response = await route.fetch(); assert.equal(response.status(), 200);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Injected interruption after commit' }) });
    } else await route.continue();
  });
  await uncertainDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).click();
  await uncertainDialog.getByRole('button', { name: 'Retry upgrade', exact: true }).waitFor();
  await waitXp(retry.id, 100350);
  const committed = await api.state(), original = requests.filter(request => request.body.type === 'facility.addxp').at(-1);
  assert.equal(committed.holdings.verdant.inventory.scrap, 0);
  await uncertainDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => { window.location.hash = '/overview?region=verdant'; });
  await page.getByText('Corporation overview', { exact: true }).waitFor();
  await open(retry.id, retry.type);
  await button('Retry upgrade').click();
  const replay = page.getByRole('dialog', { name: 'Use available scrap?', exact: true });
  await replay.getByRole('button', { name: 'Retry upgrade', exact: true }).click();
  await replay.waitFor({ state: 'hidden' }); await settled();
  const retried = requests.filter(request => request.body.type === 'facility.addxp').at(-1), replayed = await api.state();
  assert.deepEqual(retried, original); assert.equal(facility(replayed, retry.id).xp, 100350);
  assert.equal(replayed.holdings.verdant.inventory.scrap, 0); assert.deepEqual(notes(replayed).map(note => note.id), notes(committed).map(note => note.id));
  await page.unroute('**/api/action');
  assert.equal((await api.action('inventory.scrap', 'verdant', { assetId: 'lamp', quantity: 25 })).status, 200);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).holding.inventory.scrap === 25);
  const freshDialog = await review(retry.id, 'available');
  await confirmUpgrade(retry.id, 100375, 25, () => freshDialog.getByRole('button', { name: 'Confirm upgrade', exact: true }).evaluate(node => { node.click(); node.click(); }));
  const newRequest = requests.filter(request => request.body.type === 'facility.addxp').at(-1);
  assert.notEqual(newRequest.key, original.key);
  assert.equal(requests.filter(request => request.body.type === 'facility.addxp' && request.body.targetXp === 100375).length, 1);
  check('A committed upgrade with a lost response survives navigation and retries its original key/target without duplicate scrap, while a new double-clicked upgrade spends once');

  assert.equal((await api.action('inventory.scrap', 'verdant', { assetId: 'lamp', quantity: 100 })).status, 200);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).holding.inventory.scrap === 100);
  await review(retry.id, 'available');
  let releaseUpgrade, requestCommitted;
  const heldUpgrade = new Promise(resolve => { releaseUpgrade = resolve; }), committedUpgrade = new Promise(resolve => { requestCommitted = resolve; });
  await page.route('**/api/action', async route => {
    if (route.request().postDataJSON().type === 'facility.addxp') {
      const response = await route.fetch(); assert.equal(response.status(), 200); requestCommitted();
      await heldUpgrade; await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm upgrade', exact: true }).click();
  await committedUpgrade;
  await page.evaluate(() => { window.location.hash = '/overview?region=verdant'; });
  await page.getByText('Corporation overview', { exact: true }).waitFor();
  await open(retry.id, retry.type);
  assert.match(await page.locator('.facility-upgrade-pending').innerText(), /Waiting for upgrade confirmation/);
  releaseUpgrade();
  await waitXp(retry.id, 100475); await settled();
  await page.locator('.facility-upgrade-pending').waitFor({ state: 'hidden' });
  assert.equal((await api.state()).holdings.verdant.inventory.scrap, 0);
  assert.equal(requests.filter(request => request.body.type === 'facility.addxp' && request.body.targetXp === 100475).length, 1);
  await page.unroute('**/api/action');
  check('Navigating away and back during an in-flight upgrade clears remounted pending controls when its single response completes');

  assert.equal((await api.action('inventory.scrap', 'verdant', { assetId: 'lamp', quantity: 100 })).status, 200);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).holding.inventory.scrap === 100);
  await review(retry.id, 'available');
  const beforeRegion = requests.length;
  await page.evaluate(() => { window.location.hash = '/facilities?region=ironridge&tab=owned'; });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).regionId === 'ironridge');
  assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(requests.length, beforeRegion);
  await open(retry.id, retry.type);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal((await api.action('inventory.lock', 'verdant', { assetId: 'scrap' })).status, 200);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).holding.locks.includes('scrap'));
  assert.equal(await progression(retry.id).getByRole('button', { name: /^Use available scrap/ }).isDisabled(), true);
  assert.match(await progression(retry.id).innerText(), /Scrap is locked/);
  assert.equal((await api.action('inventory.lock', 'verdant', { assetId: 'scrap' })).status, 200);
  await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).holding.locks.includes('scrap'));
  check('Changing region discards an unsubmitted preview, and current regional scrap locks disable upgrades');

  await open(oil.id, oil.type);
  const trigger = page.locator(`.facility-effects-trigger[data-effects-for="${oil.id}"]`);
  await trigger.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(id => document.activeElement?.id === `facility-effects-${id}`, oil.id);
  const currentOil = facility(await api.state(), oil.id), cycleSummary = effects(oil.id).locator('summary').filter({ hasText: 'Cycle calculation & quality' });
  assert.equal(await effects(oil.id).locator('.facility-cycle-breakdown').isVisible(), false);
  const compactHeight = (await effects(oil.id).boundingBox()).height;
  for (const entry of currentOil.effects.entries) {
    const item = effects(oil.id).locator(`[data-effect-id="${entry.id}"]`), summary = item.locator('summary');
    assert.equal(await summary.getAttribute('aria-label'), `Details for ${entry.label}`);
    assert.ok((await summary.innerText()).includes(entry.label)); assert.ok((await summary.innerText()).includes(entry.value));
    assert.equal(await item.locator('.facility-effect-description').isVisible(), false);
    if (entry.expiresAt) assert.equal(await item.locator('.facility-effect-expiry').isVisible(), true);
    await summary.focus(); await page.keyboard.press('Enter');
    assert.ok((await item.locator('.facility-effect-description').innerText()).includes(entry.description));
    assert.ok((await item.locator('.facility-effect-description').innerText()).includes(entry.scope));
    assert.ok((await effects(oil.id).boundingBox()).height > compactHeight);
    await page.keyboard.press('Enter'); assert.equal(await item.locator('.facility-effect-description').isVisible(), false);
  }
  await cycleSummary.focus(); await page.keyboard.press('Enter');
  assert.match(await effects(oil.id).locator('.facility-cycle-breakdown').innerText(), /8\.715/);
  assert.match(await effects(oil.id).locator('.facility-quality-note').innerText(), /2%/);
  await page.keyboard.press('Enter'); assert.equal(await effects(oil.id).locator('.facility-cycle-breakdown').isVisible(), false);
  check('Compact effects keep source, value, tone and expiry visible; keyboard disclosures reveal descriptions, scope and cycle math and meaningfully collapse them');

  for (const [name, id] of [['Light', 'light'], ['Dark', 'dark'], ['High Contrast', 'contrast'], ['Ocean', 'ocean'], ['Sunset', 'sunset'], ['Terminal', 'terminal']]) {
    await theme(name, id);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await noOverflow();
      await detail(oil.id).screenshot({ path: `${artifacts}/progression-effects-${id}-${width}.png`, animations: 'disabled' });
      assert.equal(await progression(oil.id).getByRole('heading', { name: /Level 0/ }).isVisible(), true);
      assert.equal(await cycleSummary.isVisible(), true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  check('Progression previews and compact effects fit all six themes at desktop, 390px and 320px without horizontal overflow');

  await theme('Light', 'light'); await open(retry.id, retry.type); await review(retry.id, 'available');
  const beforeAccount = requests.filter(request => request.body.type === 'facility.addxp').length;
  const second = await page.context().newPage();
  await second.goto(server.origin + '/#/overview?region=verdant');
  await second.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await second.getByRole('button', { name: 'Sign in', exact: true }).click();
  await second.getByLabel('Username', { exact: true }).fill('progression_peer');
  await second.getByLabel('Password', { exact: true }).fill(password);
  await second.getByRole('button', { name: 'Return to corporation', exact: true }).click();
  await second.getByText('Corporation overview', { exact: true }).waitFor();
  await page.reload();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).corporation?.name === 'progression_peer');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(requests.filter(request => request.body.type === 'facility.addxp').length, beforeAccount);
  assert.equal((await api.state()).holdings.verdant.inventory.scrap, 100);
  await second.close();
  check('Signing into another account cannot retain or submit the previous corporation’s upgrade confirmation');

  if (process.env.WEB_GAME_CLIENT) {
    const result = spawnSync(process.execPath, [process.env.WEB_GAME_CLIENT, '--url', server.origin, '--actions-json', JSON.stringify({ steps: [{ buttons: [], frames: 2 }] }), '--iterations', '1', '--pause-ms', '100', '--screenshot-dir', `${artifacts}/skill-auth`], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    check('Standard develop-web-game client captured authentication alongside the authenticated progression workflow');
  }
  assert.deepEqual(errors, []); assert.deepEqual(throttled, []);
  check('No unhandled browser exceptions or throttled requests');
} catch (error) {
  failure = { message: error.message, stack: error.stack, body: await page.locator('body').innerText().catch(() => '') };
  await shot('failure').catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(`${artifacts}/report.json`, JSON.stringify({ date: new Date().toISOString(), status: failure ? 'failed' : 'passed', passed, errors, throttled, failure, fixtureScope: 'Two test accounts in an automatically removed PostgreSQL database; all exercised mutations use authenticated server actions.' }, null, 2));
  await browser.close(); await server.close();
}
