/*
  Warnings:

  - You are about to drop the column `slug` on the `character_groups` table. All the data in the column will be lost.
  - Added the required column `map_name` to the `character_groups` table without a default value. This is not possible if the table is not empty.

*/

-- Clear all character groups data first (since we're resetting)
DELETE FROM "character_groups";

-- DropIndex
DROP INDEX "KillFact_kill_time_idx";

-- DropIndex
DROP INDEX "character_groups_slug_key";

-- AlterTable
ALTER TABLE "character_groups" DROP COLUMN "slug",
ADD COLUMN     "map_name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "character_groups_map_name_idx" ON "character_groups"("map_name");

-- CreateIndex
CREATE INDEX "characters_corporation_id_idx" ON "characters"("corporation_id");

-- CreateIndex
CREATE INDEX "characters_alliance_id_idx" ON "characters"("alliance_id");

-- AddForeignKey
ALTER TABLE "map_activities" ADD CONSTRAINT "map_activities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("eve_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossFact" ADD CONSTRAINT "LossFact_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("eve_id") ON DELETE RESTRICT ON UPDATE CASCADE;
