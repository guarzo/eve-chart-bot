// bot/src/data/clients/zkillboard-client.ts

import fetch from 'node-fetch';
import { getCached, setCached } from '../cache/cache';

export interface KillRecord {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Number of kills on that date */
  count: number;
}

const BASE = process.env.ZKILLBOARD_API_URL;
if (!BASE) {
  throw new Error('ZKILLBOARD_API_URL must be defined in your .env');
}

/** 
 * Turn a period like "24h" or "7d" into a number of days to fetch 
 * ("h" always => 1 day)
 */
function parseDays(period: string): number {
  const m = period.match(/^(\d+)([dh])$/);
  if (!m) throw new Error(`Invalid period format "${period}", expected e.g. "24h" or "7d"`);
  const [_, num, unit] = m;
  return unit === 'h' ? 1 : parseInt(num, 10);
}

/** Render a Date as YYYYMMDD for the zKill “history” endpoint */
function formatDateYYYYMMDD(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  return `${Y}${M}${D}`;
}

/**
 * Fetch kill‐counts from zKillboard’s history API.
 * Aggregates kills per day, optionally filtering by pilotIds.
 */
export async function fetchKills(
  pilotIds: string[],
  period: string
): Promise<KillRecord[]> {
  const cacheKey = `zkills:${pilotIds.join(',')}:${period}`;
  const cached = getCached<KillRecord[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const days = parseDays(period);
  const now = new Date();
  const counts: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    // compute target date in UTC
    const day = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - i
    ));
    const isoDate = day.toISOString().slice(0, 10);       // "YYYY-MM-DD"
    const ymd = formatDateYYYYMMDD(day);                  // "YYYYMMDD"
    const url = `${BASE}/api/history/${ymd}.json`;

    let kills: any[] = [];
    try {
      const res = await fetch(url);
      if (res.ok) {
        kills = await res.json();
      }
    } catch (err) {
      console.error(`zkill history fetch failed for ${ymd}:`, err);
    }

    // Filter to only those kills involving our pilotIds.
    // TODO: adjust this to match the actual record structure
    const filtered = pilotIds.length
      ? kills.filter(rec => pilotIds.includes(String(rec.victim?.characterID)))
      : kills;

    counts[isoDate] = filtered.length;
  }

  const result: KillRecord[] = Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  setCached(cacheKey, result);
  return result;
}
