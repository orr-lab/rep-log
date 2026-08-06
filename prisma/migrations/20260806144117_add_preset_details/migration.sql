-- AlterTable
ALTER TABLE "ExercisePreset" ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reps" INTEGER,
ADD COLUMN     "sets" INTEGER,
ADD COLUMN     "weight" DOUBLE PRECISION;
