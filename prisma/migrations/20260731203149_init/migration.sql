-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('UPLOAD', 'YOUTUBE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "visitorPasswordHash" TEXT,
    "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoUploadsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutEntry" (
    "id" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "videoSource" "VideoSource" NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "youtubeId" TEXT,
    "durationSec" INTEGER,
    "sets" INTEGER,
    "reps" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" INTEGER NOT NULL,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "aiRating" INTEGER,
    "aiFeedback" TEXT,
    "aiFeedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WorkoutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "postedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "WorkoutEntry_exerciseName_idx" ON "WorkoutEntry"("exerciseName");

-- CreateIndex
CREATE INDEX "WorkoutEntry_recordedAt_idx" ON "WorkoutEntry"("recordedAt");

-- CreateIndex
CREATE INDEX "WorkoutEntry_userId_idx" ON "WorkoutEntry"("userId");

-- CreateIndex
CREATE INDEX "Comment_entryId_idx" ON "Comment"("entryId");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_createdAt_idx" ON "LoginAttempt"("username", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkoutEntry" ADD CONSTRAINT "WorkoutEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorkoutEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
