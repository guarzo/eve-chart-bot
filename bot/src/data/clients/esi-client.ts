import fetch from 'node-fetch';

const BASE = 'https://esi.evetech.net/latest';

export interface PilotMeta { id: number; name: string; shipType?: string; }

export async function fetchPilotMeta(
  pilotIds: number[]
): Promise<PilotMeta[]> {
  // batch ESI lookups for names/types
  return []; // stub
}
