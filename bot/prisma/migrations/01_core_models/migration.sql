-- CreateTable
CREATE TABLE "ingestion_checkpoints" (
    "streamName" TEXT NOT NULL,
    "lastSeenId" BIGINT NOT NULL,
    "lastSeenTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_checkpoints_pkey" PRIMARY KEY ("streamName")
);

-- CreateTable
CREATE TABLE "characters" (
    "eve_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alliance_id" INTEGER,
    "alliance_ticker" TEXT,
    "corporation_id" INTEGER NOT NULL,
    "corporation_ticker" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "character_group_id" TEXT,
    "last_backfill_at" TIMESTAMP(3),

    CONSTRAINT "characters_pkey" PRIMARY KEY ("eve_id")
);

-- CreateTable
CREATE TABLE "character_groups" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "main_character_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_character_group_id_idx" ON "characters"("character_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_groups_slug_key" ON "character_groups"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "character_groups_main_character_id_key" ON "character_groups"("main_character_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_character_group_id_fkey" FOREIGN KEY ("character_group_id") REFERENCES "character_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_groups" ADD CONSTRAINT "character_groups_main_character_id_fkey" FOREIGN KEY ("main_character_id") REFERENCES "characters"("eve_id") ON DELETE SET NULL ON UPDATE CASCADE; 