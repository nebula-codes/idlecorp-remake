/** Optional, explicitly original remake expansion. These are not recovered IdleCorp rules. */
export const expansionRules = {
  version: '2026.10-expansion.1', defaultEnabled: false,
  contracts: { minimumSeconds: 3600, maximumSeconds: 604800, maximumActivePerCorporation: 5, feeRate: 0, requiresLogistics: true },
  projects: { maximumActivePerRegion: 3, deadlineSeconds: 259200, maximumProductionBonus: 0.1, maximumHappinessBonus: 6, maximumExportBonus: 0.2 },
  projectTypes: [
    { id: 'community_garden', name: 'Community garden', description: 'Pool construction supplies to improve regional happiness for seven days.', requirements: { cash: 1000000, materials: { wood: 2000, cotton: 500 } }, effect: { happiness: 3 }, durationSeconds: 604800 },
    { id: 'industry_grant', name: 'Industrial improvement program', description: 'Pool machinery materials for a 5% regional production-speed bonus for one day.', requirements: { cash: 5000000, materials: { steel: 5000, wood: 10000 } }, effect: { productionSpeed: 0.05 }, durationSeconds: 86400 },
    { id: 'transport_hub', name: 'Freight coordination hub', description: 'Pool fuel and infrastructure materials to shorten newly dispatched exports by 10% for three days.', requirements: { cash: 2500000, materials: { steel: 1000, gasoline: 1000 } }, effect: { exportSpeed: 0.1 }, durationSeconds: 259200 },
  ],
} as const;

export const enhancementRules = {
  maximumGroupNameLength: 40, maximumGroupsPerRegion: 30, maximumBatchFacilities: 2000,
  maximumWatchedAssets: 24, maximumNotifications: 150,
  corporationSampleSeconds: 60, corporationHistoryPoints: 720,
  priceSampleSeconds: 3600, priceHistoryPoints: 168,
} as const;
