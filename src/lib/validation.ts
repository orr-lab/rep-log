import { z } from "zod";

export const entryInputSchema = z.object({
  exerciseName: z.string().trim().min(1, "Exercise name is required").max(200),
  weight: z.number().positive().optional().nullable(),
  gym: z.string().trim().max(120).optional().nullable(),
  grade: z.number().int().min(0).max(17).optional().nullable(),
  recordedAt: z.string().min(1, "Date is required"),
  videoSource: z.enum(["UPLOAD", "YOUTUBE"]),
  videoUrl: z.string().trim().min(1, "A video source is required"),
  youtubeId: z.string().trim().optional().nullable(),
  durationSec: z.number().int().positive().optional().nullable(),
  sets: z.number().int().positive().optional().nullable(),
  reps: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  difficulty: z.number().int().min(1).max(10),
  notes: z.string().max(5000).optional().nullable(),
  isFavorite: z.boolean().default(false),
  succeeded: z.boolean().default(true),
  // Set when this entry is created by fulfilling a planned workout (see planInputSchema below) --
  // the entries route links the plan to the new entry atomically in the same request.
  fulfillsPlanId: z.string().trim().optional().nullable(),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryUpdateSchema = entryInputSchema.partial();

// The raw upload cap is admin-configurable (see maxUploadMB on the User model, and
// getMaxUploadBytes()/setMaxUploadMB() in src/lib/users.ts) -- these are just the fallback
// default and the sane bounds enforced on that setting, not the cap itself. The video is
// compressed client-side (see src/lib/video-compress.ts) before it ever reaches Blob storage, so
// this is a ceiling on the raw file a phone camera might produce, not the storage/transfer budget
// itself. It also doubles as the actual Blob upload token's size limit
// (src/app/api/blob/upload/route.ts), so it has to comfortably cover the fallback path too: if
// compression fails for some reason, the original file is uploaded as-is rather than blocking
// the user, and it still needs to fit under this same ceiling.
export const DEFAULT_MAX_UPLOAD_MB = 2048;
export const MIN_UPLOAD_MB = 10;
export const MAX_UPLOAD_MB_CEILING = 10240;

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

// Standard complexity rule: at least 8 characters, with at least one of each character class.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol (e.g. ! @ # $ %)");

export const usernameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(32, "Username must be 32 characters or fewer")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, and _ . -");

/** First failing rule's message, for surfacing a single clear string to the client. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const setPublicProfileSchema = z.object({
  enabled: z.boolean(),
});

export const setVideoUploadsSchema = z.object({
  enabled: z.boolean(),
});

export const setMaxUploadSchema = z.object({
  maxUploadMB: z
    .number()
    .int()
    .min(MIN_UPLOAD_MB, `Must be at least ${MIN_UPLOAD_MB}MB.`)
    .max(MAX_UPLOAD_MB_CEILING, `Must be ${MAX_UPLOAD_MB_CEILING}MB or less.`),
});

export const commentInputSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(2000),
  authorName: z.string().trim().max(60).optional().nullable(),
});

export const setClimbingModeSchema = z.object({
  enabled: z.boolean(),
});

export const manualRecordInputSchema = z.object({
  exerciseName: z.string().trim().min(1, "Exercise name is required").max(200),
  weight: z.number().positive().optional().nullable(),
  gym: z.string().trim().max(120).optional().nullable(),
  grade: z.number().int().min(0).max(17).optional().nullable(),
  recordedAt: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional().nullable(),
  link: z.string().trim().max(500).optional().nullable(),
});

export const planInputSchema = z.object({
  plannedDate: z.string().min(1, "Date is required"),
  exerciseName: z.string().trim().min(1, "Exercise name is required").max(200),
  weight: z.number().positive().optional().nullable(),
  grade: z.number().int().min(0).max(17).optional().nullable(),
  sets: z.number().int().positive().optional().nullable(),
  reps: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  link: z.string().trim().max(500).optional().nullable(),
});

export const planUpdateSchema = planInputSchema;

export const exerciseCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60),
});

export const exercisePresetInputSchema = z.object({
  name: z.string().trim().min(1, "Exercise name is required").max(200),
  categoryId: z.string().trim().min(1, "Category is required"),
});
