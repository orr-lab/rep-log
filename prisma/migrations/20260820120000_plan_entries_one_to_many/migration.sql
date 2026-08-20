-- AlterTable
ALTER TABLE "WorkoutEntry" ADD COLUMN "planId" TEXT;

-- Carry over existing one-to-one links before dropping the old column, so plans that already
-- have a fulfilling entry don't lose that link.
UPDATE "WorkoutEntry" e
SET "planId" = p."id"
FROM "WorkoutPlan" p
WHERE p."fulfilledEntryId" = e."id";

-- DropForeignKey
ALTER TABLE "WorkoutPlan" DROP CONSTRAINT "WorkoutPlan_fulfilledEntryId_fkey";

-- DropIndex
DROP INDEX "WorkoutPlan_fulfilledEntryId_key";

-- AlterTable
ALTER TABLE "WorkoutPlan" DROP COLUMN "fulfilledEntryId";

-- CreateIndex
CREATE INDEX "WorkoutEntry_planId_idx" ON "WorkoutEntry"("planId");

-- AddForeignKey
ALTER TABLE "WorkoutEntry" ADD CONSTRAINT "WorkoutEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
