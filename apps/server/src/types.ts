export type Dict = Record<string, any>;
export interface Facility {
  id: string; type: string; level: number; xp: number; nextCycle: number;
  enabled: boolean; plus: boolean; allowPlus: boolean; installed: string[];
  costPaid: number; materialsPaid: Record<string, number>; builtAt: number;
  group?:string; favorite?:boolean;
  metrics?:{observedSince:number;successfulCycles:number;starvedCycles:number;capacityCycles:number;lastProducedAt?:number;idleSince?:number};
}
export interface Holding {
  land: number; landSpent: number; purchasedLand?:number; inventory: Record<string, number>; locks: string[];
  facilities: Facility[]; research: Dict[]; retail: Dict[]; npcPurchases: Record<string,number>;
  purchaseDay: number; scrap: number; blueprints?:Record<string,number>;
  productionObservation?:{since:number;inputs:Record<string,number>;outputs:Record<string,number>;capped?:boolean};
}
export interface Corp {
  id: string; name: string; motto: string; cash: number; tokens: number; score: number;
  gratitude: number; entitlement: string; privacy: boolean; createdAt: number;
  lastProcessed: number; lastSeenAt?:number; lastSeenProduced?:number; rng: number; holdings: Record<string,Holding>;
  technologies: string[]; blueprints: Record<string,number>; upgrades: Record<string,number>;
  shipments: Dict[]; inbox?:Dict[]; activity: Dict[]; stats: Record<string,number>; rewards: Record<string,number>;
  season: Dict; space: Dict; lastPrestige: number; lastLiquidation: Record<string,number>;
  pinnedGoals?:Record<string,{facilityId:string;quantity:number;createdAt:number;baselineCount?:number;targetCount?:number}>;
  watchlist?:string[]; notificationsList?:Dict[]; insights?:Dict; returnBaseline?:Dict;
  commitments?:{cash:number;assets:Record<string,number>};
  savedPlans?:Dict[];
}
export interface Region extends Dict {
  id: string; name: string; description: string; modifiers: Dict; population: number;
  happiness: number; services: Record<string,number>; policies: string[];
  candidates: Dict[]; votes: Record<string,string>; policyVotes: Record<string,string[]>;
  legislator: string | null; electionEndsAt: number; nextUpdate: number;
}
export interface Order extends Dict {
  id:string; corporationId:string; corporationName:string; regionId:string; side:'buy'|'sell';
  assetId:string; quantity:number; remaining:number; price:number; createdAt:number; status:string;
}
export interface World { revision:number; regions:Region[]; orders:Order[]; trades:Dict[]; season:Dict; lastAuditAt?:number; auditTotals?:Dict; expansionEnabled?:boolean; contracts?:Dict[]; projects?:Dict[]; }
export interface Game { world:World; corps:Corp[]; }
export class GameError extends Error { constructor(message:string, public statusCode=400) {super(message);} }
