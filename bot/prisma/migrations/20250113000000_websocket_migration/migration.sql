-- Remove the IngestionCheckpoint table as it's no longer needed
DROP TABLE IF EXISTS "ingestion_checkpoints";

-- Remove the fully_populated column from KillFact as all kills will be complete
ALTER TABLE "KillFact" DROP COLUMN IF EXISTS "fully_populated";

-- Remove last_backfill_at from characters as backfill is no longer needed
ALTER TABLE "characters" DROP COLUMN IF EXISTS "last_backfill_at";

-- Add indexes for efficient character-based queries if they don't exist
CREATE INDEX IF NOT EXISTS "idx_kill_characters_character_id" ON "kill_characters" ("character_id");
CREATE INDEX IF NOT EXISTS "idx_kill_attackers_character_id" ON "KillAttacker" ("character_id");
CREATE INDEX IF NOT EXISTS "idx_kill_victims_character_id" ON "KillVictim" ("character_id");