-- CreateTable
CREATE TABLE "EntryVideo" (
    "id" TEXT NOT NULL,
    "videoSource" "VideoSource" NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "youtubeId" TEXT,
    "durationSec" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "EntryVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryVideo_entryId_idx" ON "EntryVideo"("entryId");

-- AddForeignKey
ALTER TABLE "EntryVideo" ADD CONSTRAINT "EntryVideo_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorkoutEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
