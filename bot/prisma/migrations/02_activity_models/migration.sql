-- CreateTable
CREATE TABLE "map_activities" (
    "character_id" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "signatures" INTEGER NOT NULL,
    "connections" INTEGER NOT NULL,
    "passages" INTEGER NOT NULL,
    "alliance_id" INTEGER,
    "corporation_id" INTEGER NOT NULL,

    CONSTRAINT "map_activities_pkey" PRIMARY KEY ("character_id","timestamp")
);

-- CreateIndex
CREATE INDEX "map_activities_character_id_timestamp_idx" ON "map_activities"("character_id", "timestamp");

-- CreateIndex
CREATE INDEX "map_activities_corporation_id_timestamp_idx" ON "map_activities"("corporation_id", "timestamp"); 