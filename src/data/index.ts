/** Content registry entry point. Filled in M1; the summary is consumed by the debug hook. */
export function contentSummary(): { weapons: string[]; passives: string[]; enemies: string[]; pickups: string[] } {
  return { weapons: [], passives: [], enemies: [], pickups: [] };
}
