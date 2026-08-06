export type VideoSource = "UPLOAD" | "YOUTUBE";

export interface WorkoutEntry {
  id: string;
  exerciseName: string;
  weight: number | null;
  gym: string | null;
  grade: number | null;
  recordedAt: string;
  videoSource: VideoSource;
  videoUrl: string;
  youtubeId: string | null;
  durationSec: number | null;
  sets: number | null;
  reps: number | null;
  tags: string[];
  difficulty: number;
  notes: string | null;
  isFavorite: boolean;
  succeeded: boolean;
  aiRating: number | null;
  aiFeedback: string | null;
  aiFeedbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function exerciseKey(entry: Pick<WorkoutEntry, "exerciseName">): string {
  return entry.exerciseName.trim().toLowerCase();
}

export function gymKey(entry: Pick<WorkoutEntry, "gym">): string {
  return (entry.gym ?? "").trim().toLowerCase();
}

export interface EntryComment {
  id: string;
  body: string;
  authorName: string | null;
  postedByRole: string;
  createdAt: string;
}

export interface ManualRecord {
  id: string;
  exerciseName: string;
  weight: number | null;
  gym: string | null;
  grade: number | null;
  recordedAt: string;
  notes: string | null;
  link: string | null;
  createdAt: string;
}

export interface WorkoutPlan {
  id: string;
  plannedDate: string;
  exerciseName: string;
  weight: number | null;
  grade: number | null;
  sets: number | null;
  reps: number | null;
  notes: string | null;
  link: string | null;
  createdByRole: string;
  createdAt: string;
  fulfilledEntryId: string | null;
}

export interface ExercisePreset {
  id: string;
  name: string;
  weight: number | null;
  grade: number | null;
  sets: number | null;
  reps: number | null;
  notes: string | null;
  link: string | null;
  categoryId: string;
  createdAt: string;
}

export interface ExerciseCategory {
  id: string;
  name: string;
  createdAt: string;
  presets: ExercisePreset[];
}

export function findExercisePreset(
  categories: ExerciseCategory[],
  presetId: string
): ExercisePreset | undefined {
  for (const category of categories) {
    const preset = category.presets.find((p) => p.id === presetId);
    if (preset) return preset;
  }
  return undefined;
}
