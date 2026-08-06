-- CreateTable
CREATE TABLE "ExerciseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ExerciseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExercisePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ExercisePreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseCategory_userId_idx" ON "ExerciseCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseCategory_userId_name_key" ON "ExerciseCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "ExercisePreset_userId_idx" ON "ExercisePreset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExercisePreset_categoryId_name_key" ON "ExercisePreset"("categoryId", "name");

-- AddForeignKey
ALTER TABLE "ExerciseCategory" ADD CONSTRAINT "ExerciseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePreset" ADD CONSTRAINT "ExercisePreset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExerciseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePreset" ADD CONSTRAINT "ExercisePreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
