import data from './content.json' with { type: 'json' };

export interface Source { url: string; revisionId?: number; retrievedAt?: string }
export interface Asset { id: string; name: string; category: string; price: number; description?: string; icon: string; source?: Source; npcBuy?: boolean; npcSell?: boolean; tradeable?:boolean; retail?: boolean; scrappable?: boolean; qualityEligible?: boolean; quality?: boolean; baseAsset?: string; technologyId?: string; blueprintTechnologyId?:string; tier?: number; evidenceStatus?: string }
export interface Facility { id: string; name: string; category: string; cost: number; materials: Record<string, number>; inputs: Record<string, number>; outputs: Record<string, number>; cycleSeconds: number; xp: number; land: number; description?: string; requires?: string[]; icon: string; source?: Source }
export interface Technology { id: string; name: string; rarity: string; category: string; cost: number; materials: Record<string, number>; installCost: number; maxTier: number; upgradeCount: number; effect: Record<string, any>; description: string; icon: string; source: Source; stackable: boolean }
export interface Service { id: string; name: string; cost: number; description: string; effect: Record<string, any>; icon: string; source: Source }
export interface Policy { id: string; name: string; description: string; effect: Record<string, any>; fundingCost: number; cooldownSeconds: number; icon: string; source: Source }
export interface Region { id: string; name: string; description: string; modifiers: Record<string, number>; population: number; happiness: number; icon: string }
/** All currency values use integer US cents. All time durations use seconds. */
export const assets = data.assets as Asset[];
export const facilities = data.facilities as Facility[];
export const technologies = data.technologies as unknown as Technology[];
export const services = data.services as Service[];
export const policies = data.policies as Policy[];
export const regions = data.regions as Region[];
export const rules = data.rules;
export const content = { assets, facilities, technologies, services, policies, regions, rules };
export const assetById = new Map(assets.map(x => [x.id, x]));
export const facilityById = new Map(facilities.map(x => [x.id, x]));
export const technologyById = new Map(technologies.map(x => [x.id, x]));

export function assertMoney(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Money must be a nonnegative safe integer in cents');
  return value;
}
export function levelFromXp(xp: number): number { return Math.min(rules.maxFacilityLevel, Math.floor(Math.max(0, xp) / rules.facilityXpPerLevel)); }
export function qualityChance(level: number, plusInputFraction = 0): number { return Math.min(1, Math.max(0, level) * rules.plusChancePerLevel * (1 + Math.max(0, Math.min(1, plusInputFraction)) * rules.plusInputChanceBonus)); }
export function landPrice(purchased: number, discount = 0): number { return assertMoney(Math.round(rules.landBaseCost * rules.landGrowth ** purchased * (1 - Math.max(0, Math.min(0.8, discount))))); }
/** Frozen approximate retail model; 25% price rise halves per-store demand. */
export function retailDemand(price: number, referencePrice: number, stores: number, population: number, support = 1): number {
  if (price <= 0 || referencePrice <= 0 || stores <= 0 || population <= 0) return 0;
  const demand = rules.retail.baseDemandPerStore * stores * Math.sqrt(population / rules.retail.populationScale) * Math.max(0.1, Math.min(1, support));
  return Math.floor(demand / 2 ** (Math.log(price / referencePrice) / Math.log(1.25)));
}
export function exportFuel(assetPrice: number, quantity: number, gasolinePrice: number): number { return Math.ceil(assetPrice * quantity * rules.export.fuelValueRatio / Math.max(1, gasolinePrice)); }
export const airportIntervals = [30,31,31,32,32,33,33,34,34,35,36,36,37,38,38,39,40,41,41,42,43,44,45,46,47,49,50,52,54,60];
export function airportInterval(count: number): number { return airportIntervals[Math.min(29, Math.max(0, count - 1))]; }
