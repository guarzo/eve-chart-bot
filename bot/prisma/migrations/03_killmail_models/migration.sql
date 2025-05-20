-- CreateTable
CREATE TABLE "KillFact" (
    "killmail_id" BIGINT NOT NULL,
    "kill_time" TIMESTAMP(3) NOT NULL,
    "npc" BOOLEAN NOT NULL,
    "solo" BOOLEAN NOT NULL,
    "awox" BOOLEAN NOT NULL,
    "ship_type_id" INTEGER NOT NULL,
    "system_id" INTEGER NOT NULL,
    "labels" TEXT[],
    "total_value" BIGINT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "KillFact_pkey" PRIMARY KEY ("killmail_id")
);

-- CreateTable
CREATE TABLE "LossFact" (
    "killmail_id" BIGINT NOT NULL,
    "character_id" BIGINT NOT NULL,
    "kill_time" TIMESTAMP(3) NOT NULL,
    "ship_type_id" INTEGER NOT NULL,
    "system_id" INTEGER NOT NULL,
    "total_value" BIGINT NOT NULL,
    "attacker_count" INTEGER NOT NULL,
    "labels" TEXT[],

    CONSTRAINT "LossFact_pkey" PRIMARY KEY ("killmail_id")
);

-- CreateTable
CREATE TABLE "KillAttacker" (
    "id" SERIAL NOT NULL,
    "killmail_id" BIGINT NOT NULL,
    "character_id" BIGINT,
    "corporation_id" BIGINT,
    "alliance_id" BIGINT,
    "damage_done" INTEGER NOT NULL,
    "final_blow" BOOLEAN NOT NULL,
    "security_status" DOUBLE PRECISION,
    "ship_type_id" INTEGER,
    "weapon_type_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillAttacker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KillVictim" (
    "id" SERIAL NOT NULL,
    "killmail_id" BIGINT NOT NULL,
    "character_id" BIGINT,
    "corporation_id" BIGINT,
    "alliance_id" BIGINT,
    "ship_type_id" INTEGER NOT NULL,
    "damage_taken" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillVictim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KillCharacter" (
    "killmail_id" BIGINT NOT NULL,
    "character_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "KillCharacter_pkey" PRIMARY KEY ("killmail_id", "character_id")
);

-- CreateIndex
CREATE INDEX "KillFact_kill_time_idx" ON "KillFact"("kill_time");

-- CreateIndex
CREATE INDEX "LossFact_character_id_kill_time_idx" ON "LossFact"("character_id", "kill_time");

-- CreateIndex
CREATE INDEX "KillAttacker_killmail_id_idx" ON "KillAttacker"("killmail_id");

-- CreateIndex
CREATE INDEX "KillAttacker_character_id_idx" ON "KillAttacker"("character_id");

-- CreateIndex
CREATE INDEX "KillVictim_killmail_id_idx" ON "KillVictim"("killmail_id");

-- CreateIndex
CREATE INDEX "KillVictim_character_id_idx" ON "KillVictim"("character_id");

-- CreateIndex
CREATE INDEX "KillCharacter_character_id_idx" ON "KillCharacter"("character_id");

-- AddForeignKey
ALTER TABLE "KillAttacker" ADD CONSTRAINT "KillAttacker_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "KillFact"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillVictim" ADD CONSTRAINT "KillVictim_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "KillFact"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillCharacter" ADD CONSTRAINT "KillCharacter_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "KillFact"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillCharacter" ADD CONSTRAINT "KillCharacter_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("eve_id") ON DELETE CASCADE ON UPDATE CASCADE; 