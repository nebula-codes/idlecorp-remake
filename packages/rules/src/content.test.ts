import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assets, facilities, technologies, policies, services, regions, rules, assetById, facilityById, levelFromXp, qualityChance, landPrice, retailDemand, exportFuel, airportInterval } from './index.js';

describe('pinned wiki content and original local artwork', () => {
  it('has complete stable identifiers and resolves every recipe, construction and technology reference', () => {
    for (const list of [assets, facilities, technologies, policies, services, regions]) {
      expect(new Set(list.map(x => x.id)).size).toBe(list.length);
      for (const entity of list) expect(entity.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    for (const f of facilities) {
      for (const [id, amount] of Object.entries({ ...f.inputs, ...f.outputs, ...f.materials })) {
        expect(id === 'cash' || assetById.has(id), `${f.id} -> ${id}`).toBe(true);
        expect(Number.isSafeInteger(amount) && amount > 0).toBe(true);
      }
      expect(Number.isSafeInteger(f.cost) && f.cost >= 0).toBe(true);
      if (Object.keys(f.outputs).length) expect(f.cycleSeconds).toBeGreaterThan(0);
      for (const id of f.requires || []) expect(facilityById.has(id.replace('global:', ''))).toBe(true);
    }
    for (const tech of technologies) {
      for (const id of Object.keys(tech.materials)) expect(assetById.has(id)).toBe(true);
      expect(tech.maxTier).toBeGreaterThanOrEqual(1);
      expect(tech.maxTier).toBeLessThanOrEqual(3);
      for (let tier = 1; tier <= tech.maxTier; tier++) expect(assetById.has(tech.id + (tier > 1 ? '_' + 'u'.repeat(tier - 1) : ''))).toBe(true);
    }
  });
  it('includes transport and space facilities omitted by category tables', () => {
    for (const id of ['truck_factory','air_traffic_control','space_station_parts_factory','rocket_launch_pad']) expect(facilityById.has(id)).toBe(true);
    expect(facilities).toHaveLength(44);
    expect(technologies).toHaveLength(18);
    expect(services).toHaveLength(7);
    expect(policies).toHaveLength(9);
  });
  it('maps every entity to a local accessible icon with provenance', () => {
    const manifest = JSON.parse(readFileSync(resolve('docs/research/icon-manifest.json'), 'utf8')) as {entityId:string; localPath:string; sha256:string; status:string}[];
    for (const entity of [...assets, ...facilities, ...technologies, ...services, ...policies, ...regions]) {
      const entry = manifest.find(x => x.entityId === entity.id);
      expect(entry, entity.id).toBeDefined();
      expect(entry?.sha256).toMatch(/^[a-f0-9]{64}$/);
      const path = resolve('apps/web/public' + entity.icon);
      expect(existsSync(path), entity.icon).toBe(true);
      expect(readFileSync(path, 'utf8')).toContain('<title>');
    }
  });
  it('pins sources and correctly distinguishes quality and NPC restrictions', () => {
    for (const entity of [...assets, ...facilities, ...technologies, ...services, ...policies]) expect(entity.source?.revisionId, entity.id).toBeGreaterThan(0);
    expect(assetById.get('wood')?.price).toBe(15);
    expect(assetById.get('crude_oil')?.price).toBe(10);
    expect(assetById.get('car')?.npcBuy).toBe(false);
    expect(assetById.get('wood_plus')?.npcBuy).toBe(false);
    expect(assetById.get('wood_plus')?.price).toBe(30);
    expect(assetById.get('truck')?.scrappable).toBe(true);
  });
});
describe('documented economy examples and declared approximations', () => {
  it('preserves representative wiki recipe, cost, and interval examples', () => {
    expect(facilityById.get('tree_farm')).toMatchObject({cost:10000,outputs:{wood:2},cycleSeconds:5});
    expect(facilityById.get('steel_mill')).toMatchObject({inputs:{iron:1,coal:4},outputs:{steel:1},cycleSeconds:35});
    expect(facilityById.get('gasoline_engine_factory')?.cycleSeconds).toBe(260);
    expect(facilityById.get('hq')?.cost).toBe(1760000000);
    expect(facilityById.get('space_station_parts_factory')?.inputs.rubber).toBe(1000);
  });
  it('uses 100000 XP per level and base half-percent quality chance per level', () => {
    expect(levelFromXp(99999)).toBe(0);
    expect(levelFromXp(100000)).toBe(1);
    expect(levelFromXp(9000000)).toBe(50);
    expect(qualityChance(20)).toBe(0.1);
    expect(qualityChance(20,1)).toBe(0.2);
    expect(qualityChance(1000,1)).toBe(1);
  });
  it('keeps all research outcomes reachable with normalized independent rarity pools', () => {
    expect(Object.values(rules.research.rarities).reduce((a,b)=>a+b,0)).toBe(1);
    for (const pool of Object.values(rules.research.rewards)) for (const reward of pool) expect(reward.kind==='asset'?assetById.has(reward.id):technologies.some(t=>t.id===reward.id)).toBe(true);
    expect(rules.research.rewards.rare).toContainEqual({kind:'asset',id:'rocket'});
  });
  it('fixes unknown formulas as stable configurable approximations', () => {
    expect(landPrice(0)).toBe(60000);
    expect(landPrice(0,0.8)).toBe(12000);
    expect(landPrice(10)).toBeGreaterThan(landPrice(9));
    expect(retailDemand(12500,10000,10,250000)).toBe(50);
    expect(retailDemand(10000,10000,10,250000)).toBe(100);
    expect(exportFuel(10000,10,500)).toBe(40);
    expect(airportInterval(1)).toBe(30);
    expect(airportInterval(100)).toBe(60);
  });
});
