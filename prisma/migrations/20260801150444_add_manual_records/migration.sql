-- CreateTable
CREATE TABLE "ManualRecord" (
    "id" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "gym" TEXT,
    "grade" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ManualRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualRecord_userId_idx" ON "ManualRecord"("userId");

-- AddForeignKey
ALTER TABLE "ManualRecord" ADD CONSTRAINT "ManualRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
