-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "grade" INTEGER,
    "sets" INTEGER,
    "reps" INTEGER,
    "notes" TEXT,
    "link" TEXT,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "fulfilledEntryId" TEXT,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlan_fulfilledEntryId_key" ON "WorkoutPlan"("fulfilledEntryId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_plannedDate_idx" ON "WorkoutPlan"("userId", "plannedDate");

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_fulfilledEntryId_fkey" FOREIGN KEY ("fulfilledEntryId") REFERENCES "WorkoutEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
