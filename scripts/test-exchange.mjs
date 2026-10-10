/* global innerWidth, scrollTo */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { testServer, client, sleep } from './test-support.mjs';

process.env.BACKUP_ENABLED = 'false';
const server = await testServer('exchange', 3049), api = client(server.origin);
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const artifacts = 'artifacts/exchange', passed = [], errors = [], throttled = [], requests = [];
let expectedRetryThrottle = false;
const password = 'Regional-exchange-test-42!', username = 'exchange_owner';
fs.mkdirSync(artifacts, { recursive: true });
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() === 429 && !expectedRetryThrottle) throttled.push(response.url()); });
page.on('request', request => { if (new URL(request.url()).pathname === '/api/action') requests.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() }); });
const check = name => { passed.push(name); console.log('PASS ' + name); };
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const row = id => page.locator(`[data-market-resource="${id}"]`);
const quick = (id, size) => row(id).locator(`[data-quick-sell="${size}"]`);
const button = name => page.getByRole('button', { name, exact: true }).first();
const inStock = () => page.getByRole('button', { name: /^In stock/ }).click();
const customButton = (id, side) => row(id).locator('.market-custom-trade').getByRole('button', { name: new RegExp(`^${side} `) });
const search = value => page.getByLabel('Search market resources', { exact: true }).fill(value);
const settled = () => page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).busy);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
const shot = async name => { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true, animations: 'disabled' }); };
const openTrade = async (id, name) => { const target = row(id).getByRole('button', { name: `Trade ${name}`, exact: true }); if ((await target.getAttribute('aria-expanded')) !== 'true') await target.click(); await row(id).getByLabel('Trade quantity', { exact: true }).waitFor(); };
const waitInventory = (assetId, quantity) => page.waitForFunction(({ assetId, quantity }) => JSON.parse(window.render_game_to_text()).holding?.inventory[assetId] === quantity, { assetId, quantity });
async function trade(type, assetId, quantity, operation, regionId = 'verdant') {
  const before = await api.state();
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/action' && response.request().postDataJSON().type === type && response.request().postDataJSON().assetId === assetId),
    operation(),
  ]);
  assert.equal(response.status(), 200, await response.text());
  const after = await response.json(), sign = type === 'npc.buy' ? 1 : -1;
  assert.equal(after.holdings[regionId].inventory[assetId], (before.holdings[regionId].inventory[assetId] || 0) + sign * quantity);
  const price = after.market.quotes[regionId][assetId][type === 'npc.buy' ? 'buy' : 'sell'];
  assert.equal(after.corporation.cash, before.corporation.cash - sign * price * quantity, 'NPC trade must use the authoritative unit quote with no extra sale fee');
  await settled(); await waitInventory(assetId, after.holdings[regionId].inventory[assetId]);
  return after;
}
async function theme(name, id) {
  await button('Choose theme').click();
  await page.getByRole('dialog', { name: 'Appearance', exact: true }).getByRole('radio', { name, exact: true }).locator('..').click();
  await button('Done').click();
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, id);
}
let failure;
try {
  assert.equal((await api.request('/api/auth/register', { username, password, name: 'Regional Trading Works' })).status, 200);
  const corporationId = (await api.state()).corporation.id;
  await server.stop();
  const record = (await server.query('SELECT state FROM corporations WHERE id=$1', [corporationId])).rows[0].state;
  record.cash = 1000000; record.lastProcessed = Date.now();
  record.holdings.verdant.inventory = { wood: 25000, wood_plus: 12000, steel: 5000, oil_mapping: 2, blueprint_oil_mapping: 1, crude_oil: 1000123, bauxite: 99, energy: 0, cotton: 1000, cotton_plus: 9000000000000, iron: 25000, coal: 3000 };
  record.holdings.verdant.locks = ['steel'];
  record.holdings.ironridge.land = 1; record.holdings.ironridge.inventory = { wood: 777 };
  await server.query('UPDATE corporations SET state=$1 WHERE id=$2', [JSON.stringify(record), corporationId]);
  await server.start();
  await page.goto(server.origin); await button('Sign in').click();
  await page.getByLabel('Username', { exact: true }).fill(username); await page.getByLabel('Password', { exact: true }).fill(password);
  await button('Return to corporation').click(); await page.getByText('Corporation overview', { exact: true }).waitFor(); await button('Exchange').click();
  await button('Regional market').click(); await page.getByLabel('Search market resources', { exact: true }).waitFor();

  await inStock(); await search('');
  const owned = await page.locator('[data-market-resource]').evaluateAll(nodes => nodes.map(node => node.dataset.marketResource));
  for (const id of ['wood', 'wood_plus', 'steel', 'oil_mapping', 'bauxite', 'cotton', 'iron', 'coal']) assert.ok(owned.includes(id));
  assert.ok(!owned.includes('energy'));
  await page.getByLabel('Sort market resources', { exact: true }).selectOption('stock');
  const sorted = await page.locator('[data-market-resource]').evaluateAll(nodes => nodes.map(node => node.dataset.marketResource));
  const initialInventory = (await api.state()).holdings.verdant.inventory;
  for (let index = 1; index < sorted.length; index++) assert.ok(initialInventory[sorted[index - 1]] >= initialInventory[sorted[index]]);
  await page.getByLabel('Sort market resources', { exact: true }).selectOption('name');
  await search('Wood'); assert.equal(await page.locator('[data-market-resource]').count(), 2);
  await search('nothing matches this search'); assert.equal(await page.locator('[data-market-resource]').count(), 0);
  await search(''); await button('All resources').click(); assert.ok(await page.locator('[data-market-resource]').count() > owned.length);
  check('Search finds normal and plus resources, stock/all filters work, quantity sorting is correct and an empty search result is safe');

  for (const id of ['steel', 'oil_mapping', 'energy']) for (const size of ['100', '1000', '10000', 'all']) assert.equal(await quick(id, size).isDisabled(), true, `${id} ${size} should not be sellable`);
  assert.equal(await quick('bauxite', '100').isDisabled(), true); assert.equal(await quick('bauxite', 'all').isEnabled(), true);
  assert.equal(await quick('cotton_plus', 'all').isDisabled(), true, 'Sell all must respect remaining cash ledger capacity');
  assert.equal(await quick('cotton_plus', '100').isEnabled(), true, 'An affordable partial sale remains available at large stock');
  assert.match(await row('steel').innerText(), /locked/i);
  await search('Oil mapping'); await openTrade('oil_mapping', 'Oil mapping');
  assert.equal(await customButton('oil_mapping', 'Buy').isDisabled(), true);
  assert.equal(await customButton('oil_mapping', 'Sell').isDisabled(), true);
  check('Locked, NPC-restricted, empty and undersized holdings disable unsafe quick sales; restricted custom trades remain disabled');

  await search('Wood');
  for (const quantity of [100, 1000, 10000]) await trade('npc.sell', 'wood', quantity, () => quick('wood', String(quantity)).click());
  const remainder = (await api.state()).holdings.verdant.inventory.wood;
  assert.equal(remainder, 13900); await trade('npc.sell', 'wood', remainder, () => quick('wood', 'all').click());
  assert.equal((await api.state()).holdings.verdant.inventory.wood_plus, 12000);
  assert.equal(await quick('wood', 'all').isDisabled(), true);
  check('100, 1,000, 10,000 and Sell all are real one-click sales with exact server-confirmed stock and cash changes, without touching plus stock');

  const woodTrigger = row('wood').getByRole('button', { name: 'Trade Wood', exact: true });
  if ((await woodTrigger.getAttribute('aria-expanded')) === 'true') await woodTrigger.click();
  await woodTrigger.focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await row('wood').getByLabel('Trade quantity', { exact: true }).evaluate(node => node === document.activeElement), true);
  await row('wood').getByLabel('Trade quantity', { exact: true }).fill('123');
  await trade('npc.buy', 'wood', 123, () => customButton('wood', 'Buy').click());
  await row('wood').getByLabel('Trade quantity', { exact: true }).fill('23');
  await trade('npc.sell', 'wood', 23, () => customButton('wood', 'Sell').click());
  await row('wood').getByLabel('Trade quantity', { exact: true }).fill('1000000');
  assert.equal(await customButton('wood', 'Buy').isDisabled(), true);
  assert.equal(await customButton('wood', 'Sell').isDisabled(), true);
  await row('wood').getByLabel('Trade quantity', { exact: true }).fill('1');
  await trade('npc.sell', 'wood_plus', 1000, () => quick('wood_plus', '1000').click());
  assert.equal((await api.state()).holdings.verdant.inventory.wood, 100);
  await openTrade('wood_plus', 'Wood+');
  assert.equal(await customButton('wood_plus', 'Buy').isDisabled(), true);
  check('Keyboard-opened custom buy/sell controls honor quantity and affordability, while plus-resource sales remain separate and plus purchases stay restricted');

  await search('Oil mapping blueprint');
  await trade('npc.sell', 'blueprint_oil_mapping', 1, () => quick('blueprint_oil_mapping', 'all').click());
  await search('Crude oil'); await trade('npc.sell', 'crude_oil', 1000123, () => quick('crude_oil', 'all').click());
  check('NPC-sellable blueprints remain eligible despite player-trade restrictions; Sell all exceeds one million units while cash-capacity guards prevent overflow');

  await page.getByLabel('Active region', { exact: true }).selectOption('ironridge'); await button('All resources').click(); await search('Wood');
  await trade('npc.sell', 'wood', 100, () => quick('wood', '100').click(), 'ironridge');
  const regional = await api.state(); assert.equal(regional.holdings.ironridge.inventory.wood, 677); assert.equal(regional.holdings.verdant.inventory.wood, 100);
  await page.getByLabel('Active region', { exact: true }).selectOption('verdant'); await button('All resources').click(); await search('Iron');
  const rapidBefore = requests.length;
  await trade('npc.sell', 'iron', 100, () => quick('iron', '100').evaluate(node => { node.click(); node.click(); }));
  await sleep(100); assert.equal(requests.length, rapidBefore + 1);
  check('Trades use the current region and synchronous repeated quick-sale clicks produce one request and one inventory/cash mutation');

  // Hold the browser's old quantity while a second authenticated session sells it.
  await search('Cotton');
  let held, interceptedResolve;
  const intercepted = new Promise(resolve => { interceptedResolve = resolve; });
  await page.route('**/api/action', async route => { if (!held && route.request().postDataJSON().type === 'npc.sell' && route.request().postDataJSON().assetId === 'cotton') { held = route; interceptedResolve(); } else await route.continue(); });
  const staleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/action' && response.request().postDataJSON().assetId === 'cotton');
  await quick('cotton', 'all').click(); await intercepted;
  const concurrent = await api.action('npc.sell', 'verdant', { assetId: 'cotton', quantity: 1000 }); assert.equal(concurrent.status, 200);
  await held.continue(); assert.equal((await staleResponse).status(), 400);
  await page.getByRole('alert').filter({ hasText: /Missing cotton/i }).waitFor(); await settled(); await waitInventory('cotton', 0);
  await page.unroute('**/api/action');
  assert.equal((await api.state()).corporation.cash, concurrent.data.corporation.cash);
  assert.equal(await row('cotton').getByRole('button', { name: 'Clear sale attempt', exact: true }).isVisible(), true, 'A definitive rejected sale can be cleared');
  await row('cotton').getByRole('button', { name: 'Clear sale attempt', exact: true }).click();
  await openTrade('cotton', 'Cotton'); await row('cotton').getByLabel('Trade quantity', { exact: true }).fill('200');
  await trade('npc.buy', 'cotton', 200, () => customButton('cotton', 'Buy').click());
  await trade('npc.sell', 'cotton', 200, () => customButton('cotton', 'Sell').click());
  check('A real concurrent sale makes a stale request fail safely; the UI refreshes stock, exits busy state and permits a fresh successful trade');

  // Commit Sell all, lose its response, then change stock before retrying. The
  // retry must retain the original quantity/key even though all now means 250.
  await search('Coal'); await inStock();
  let faultInjected = false, retryThrottled = false, routeError, committed;
  await page.route('**/api/action', async route => {
    try {
      const payload = route.request().postDataJSON();
      if (!faultInjected && payload.type === 'npc.sell' && payload.assetId === 'coal') {
        faultInjected = true; const response = await route.fetch(); assert.equal(response.status(), 200);
        committed = await response.json(); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated lost committed sale response' }) });
      } else if (faultInjected && !retryThrottled && payload.type === 'npc.sell' && payload.assetId === 'coal') {
        retryThrottled = true; expectedRetryThrottle = true;
        await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated retry rate limit before idempotency lookup' }) });
      } else await route.continue();
    } catch (error) { routeError = error; await route.abort('failed').catch(() => {}); }
  });
  await quick('coal', 'all').click(); await page.getByRole('alert').filter({ hasText: 'Simulated lost committed sale response' }).waitFor();
  await settled(); await waitInventory('coal', 0); assert.equal(routeError, undefined); assert.ok(committed);
  assert.equal(await row('coal').count(), 1, 'Uncertain sale must stay visible after its stock reaches zero');
  assert.equal(await row('coal').getByRole('button', { name: 'Clear sale attempt', exact: true }).count(), 0, 'An uncertain sale must be resolved by retrying its original request before a fresh sale');
  const attempt = requests.at(-1); assert.equal(attempt.body.quantity, 3000);
  const newStock = await api.action('npc.buy', 'verdant', { assetId: 'coal', quantity: 250 }); assert.equal(newStock.status, 200);
  await waitInventory('coal', 250);
  await row('coal').getByRole('button', { name: 'Retry sale', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Simulated retry rate limit before idempotency lookup' }).waitFor(); await settled();
  assert.equal(retryThrottled, true); expectedRetryThrottle = false;
  assert.deepEqual(requests.at(-1), attempt, 'Rate-limited retry must retain the original sale payload and key');
  assert.equal(await row('coal').getByRole('button', { name: 'Clear sale attempt', exact: true }).count(), 0, 'A rate-limited retry cannot resolve the earlier uncertain commit');
  const afterRateLimit = await api.state();
  assert.equal(afterRateLimit.holdings.verdant.inventory.coal, 250); assert.equal(afterRateLimit.corporation.cash, newStock.data.corporation.cash);
  await row('coal').getByRole('button', { name: 'Retry sale', exact: true }).click(); await settled();
  assert.deepEqual(requests.at(-1), attempt, 'Retry must use the original exact sale payload and idempotency key');
  const recovered = await api.state(); assert.equal(recovered.holdings.verdant.inventory.coal, 250); assert.equal(recovered.corporation.cash, newStock.data.corporation.cash);
  assert.equal(await row('coal').getByRole('button', { name: 'Retry sale', exact: true }).count(), 0);
  await page.unroute('**/api/action');
  await trade('npc.sell', 'coal', 250, () => quick('coal', 'all').click());
  assert.notEqual(requests.at(-1).key, attempt.key);
  const coalAudit = await server.query("SELECT count(*) FROM economic_audit WHERE account_id=$1 AND action='npc.sell' AND payload->>'assetId'='coal'", [corporationId]);
  assert.equal(Number(coalAudit.rows[0].count), 2);
  check('Lost committed Sell all response remains uncertain through a rate-limited retry, then resolves with the original quantity/key after new stock arrives without double-selling; a fresh sale gets a new key');

  await search('Wood'); await inStock();
  await button('Inventory').click(); await page.getByLabel('Show unowned resources', { exact: true }).check();
  await page.getByLabel('Search inventory', { exact: true }).fill('Energy');
  await page.locator('tr').filter({ has: page.getByText('Energy', { exact: true }) }).getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('dialog', { name: 'Energy', exact: true }).getByRole('button', { name: 'Trade resource', exact: true }).click();
  await row('energy').getByLabel('Trade quantity', { exact: true }).waitFor();
  assert.equal((await state()).screen, 'market'); assert.equal((await state()).holding.inventory.energy, 0);
  assert.equal(await quick('energy', 'all').isDisabled(), true);
  check('Inventory Trade resource navigation reveals and expands an unowned resource despite prior stock/search filters');

  await button('All resources').click(); await search('Wood'); await openTrade('wood', 'Wood');
  for (const [name, id] of [['Light', 'light'], ['Dark', 'dark'], ['High Contrast', 'contrast']]) {
    await theme(name, id); await noOverflow(); await shot(`desktop-${id}`);
    for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); await noOverflow(); await shot(`mobile-${id}-${width}`); assert.equal(await quick('wood_plus', '1000').isVisible(), true); assert.equal(await row('wood').getByLabel('Trade quantity', { exact: true }).isVisible(), true); }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  check('Searchable rows and expanded trading fit desktop, 390px and 320px in Light, Dark and High Contrast without horizontal overflow');
  if (process.env.WEB_GAME_CLIENT) {
    const result = spawnSync(process.execPath, [process.env.WEB_GAME_CLIENT, '--url', server.origin, '--actions-json', JSON.stringify({ steps: [{ buttons: [], frames: 2 }] }), '--iterations', '1', '--pause-ms', '100', '--screenshot-dir', `${artifacts}/skill-auth`], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr); check('Standard develop-web-game client ran; authenticated interactions are covered by the real trading workflow');
  }
  assert.deepEqual(errors, []); assert.deepEqual(throttled, []); check('No unhandled browser exceptions or unexpected throttled requests');
} catch (error) { failure = error; await shot('failure').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-9000)); }
finally {
  await browser.close(); await server.close();
  fs.writeFileSync(`${artifacts}/report.json`, JSON.stringify({ date: new Date().toISOString(), status: failure ? 'failed' : 'passed', error: failure?.message, passed, errors, throttled, expectedInjectedFaults: ['503 replaces a successfully committed sale response', '429 rejects its first retry before forwarding to the server'], attempts: requests, fixtureScope: 'One test corporation, separate authenticated sessions and an automatically removed disposable PostgreSQL database; all inspected trades use the real server.' }, null, 2));
}
if (failure) throw failure;
