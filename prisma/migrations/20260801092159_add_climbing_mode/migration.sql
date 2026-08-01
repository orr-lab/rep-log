-- AlterTable
ALTER TABLE "User" ADD COLUMN     "climbingMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkoutEntry" ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "gym" TEXT;

-- CreateIndex
CREATE INDEX "WorkoutEntry_gym_idx" ON "WorkoutEntry"("gym");
