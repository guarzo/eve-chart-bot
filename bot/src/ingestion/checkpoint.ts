// bot/src/ingestion/checkpoint.ts

import { db } from '../lib/db'

/**
 * Get the last‐seen checkpoint for a given stream.
 * If none exists yet, returns null.
 */
export async function getCheckpoint(stream: string) {
  return db.ingestionCheckpoint.findUnique({
    where: { streamName: stream }
  })
}

/**
 * Update or create the checkpoint for a stream.
 */
export async function upsertCheckpoint(
  stream: string,
  lastSeenId: bigint,
  lastSeenTime: Date
) {
  await db.ingestionCheckpoint.upsert({
    where: { streamName: stream },
    create: { streamName: stream, lastSeenId, lastSeenTime },
    update: { lastSeenId, lastSeenTime }
  })
}
