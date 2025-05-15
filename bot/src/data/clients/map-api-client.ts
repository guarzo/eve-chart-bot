import fetch from 'node-fetch';

const BASE = process.env.WANDERER_API_URL!;

export interface MapActivity { date: string; jumps: number; visits: number; }

export async function fetchMapActivity(
  pilotIds: string[],
  period: string
): Promise<MapActivity[]> {
  // same pattern: cache key; GET `${BASE}/activity?pilots=...&period=...`
  return []; // stub
}
