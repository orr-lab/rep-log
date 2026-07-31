export type VideoSource = "UPLOAD" | "YOUTUBE";

export interface WorkoutEntry {
  id: string;
  exerciseName: string;
  weight: number | null;
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
  aiRating: number | null;
  aiFeedback: string | null;
  aiFeedbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function exerciseKey(entry: Pick<WorkoutEntry, "exerciseName">): string {
  return entry.exerciseName.trim().toLowerCase();
}

export interface EntryComment {
  id: string;
  body: string;
  authorName: string | null;
  postedByRole: string;
  createdAt: string;
}
