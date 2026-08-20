"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { UploadCloud, Link2, Film, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/tag-input";
import { ExertionPicker } from "@/components/exertion-picker";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";
import { extractVideoCreationDate } from "@/lib/video-metadata";
import { compressVideo } from "@/lib/video-compress";
import { COMMON_EXERCISES, COMMON_TAGS } from "@/lib/exercise-catalog";
import { GRADE_OPTIONS, formatGrade, COMMON_CLIMBING_TAGS } from "@/lib/climbing";
import { findExercisePreset } from "@/lib/types";
import type { WorkoutEntry, VideoSource, ExerciseCategory } from "@/lib/types";
import { AdditionalVideoSlot, type SavedAdditionalVideo } from "@/components/additional-video-slot";

function toDateInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMaxSize(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export interface PlanPrefill {
  id: string;
  exerciseName: string;
  weight: number | null;
  grade: number | null;
  sets: number | null;
  reps: number | null;
  notes: string | null;
}

export function WorkoutEntryForm({
  mode,
  initialData,
  userId,
  uploadsEnabled,
  maxUploadBytes,
  climbingMode,
  fromPlan,
}: {
  mode: "create" | "edit";
  initialData?: WorkoutEntry;
  userId: string;
  uploadsEnabled: boolean;
  /** Admin-configurable raw-upload ceiling (see Settings > Storage), in bytes. */
  maxUploadBytes: number;
  climbingMode: boolean;
  /** Pre-fills the form from a planned workout (see /plan) and links the saved entry back to it. */
  fromPlan?: PlanPrefill;
}) {
  const router = useRouter();

  const [exerciseName, setExerciseName] = useState(
    initialData?.exerciseName ?? fromPlan?.exerciseName ?? ""
  );
  const [weight, setWeight] = useState(
    (initialData?.weight ?? fromPlan?.weight)?.toString() ?? ""
  );
  const [gym, setGym] = useState(initialData?.gym ?? "");
  const [grade, setGrade] = useState((initialData?.grade ?? fromPlan?.grade)?.toString() ?? "");
  const [recordedAt, setRecordedAt] = useState(toDateInputValue(initialData?.recordedAt));
  // Tracks whether the user has touched the date field themselves, so an uploaded video's
  // metadata date (see onDrop below) only ever fills in an untouched field -- it never clobbers
  // a date the user already set or already changed their mind about.
  const dateManuallyEditedRef = useRef(false);
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? 5);
  const [sets, setSets] = useState((initialData?.sets ?? fromPlan?.sets)?.toString() ?? "");
  const [reps, setReps] = useState((initialData?.reps ?? fromPlan?.reps)?.toString() ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? fromPlan?.notes ?? "");
  const [isFavorite, setIsFavorite] = useState(initialData?.isFavorite ?? false);
  const [succeeded, setSucceeded] = useState(initialData?.succeeded ?? true);

  const [videoSource, setVideoSource] = useState<VideoSource>(
    initialData?.videoSource ?? (uploadsEnabled ? "UPLOAD" : "YOUTUBE")
  );
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [youtubeId, setYoutubeId] = useState<string | null>(initialData?.youtubeId ?? null);
  const [youtubeInput, setYoutubeInput] = useState(
    initialData?.videoSource === "YOUTUBE" ? initialData.videoUrl : ""
  );
  const [durationSec, setDurationSec] = useState<number | null>(initialData?.durationSec ?? null);
  const [durationDetected, setDurationDetected] = useState(false);
  const [replacingVideo, setReplacingVideo] = useState(mode === "create");

  // Extra clips attached to this same entry, beyond the primary video above (see EntryVideo).
  // Prefilled from the entry's existing extras in edit mode; `key` is just a stable React key,
  // unrelated to anything sent to the server.
  const [additionalVideos, setAdditionalVideos] = useState<(SavedAdditionalVideo & { key: string })[]>(
    () =>
      (initialData?.videos ?? []).map((v) => ({
        key: v.id,
        videoSource: v.videoSource,
        videoUrl: v.videoUrl,
        youtubeId: v.youtubeId,
        durationSec: v.durationSec,
      }))
  );
  const [addingVideo, setAddingVideo] = useState(false);

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Which action triggered the in-flight save, so only that button shows its own spinner instead
  // of both lighting up together.
  const [submittingAction, setSubmittingAction] = useState<"save" | "save-and-another" | null>(
    null
  );
  // Logging several videos for the same exercise back-to-back (see "Save & log another" below) --
  // just a running count shown in that button's feedback toast, not persisted anywhere.
  const [loggedCount, setLoggedCount] = useState(0);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const [loggedExercises, setLoggedExercises] = useState<string[]>([]);
  const [loggedTags, setLoggedTags] = useState<string[]>([]);
  const [loggedGyms, setLoggedGyms] = useState<string[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);

  useEffect(() => {
    fetch("/api/facets")
      .then((r) => r.json())
      .then((data) => {
        setLoggedExercises(Array.isArray(data.exercises) ? data.exercises : []);
        setLoggedTags(Array.isArray(data.tags) ? data.tags : []);
        setLoggedGyms(Array.isArray(data.gyms) ? data.gyms : []);
      })
      .catch(() => {});
    fetch("/api/exercise-categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Route/problem names don't have a "common catalog" the way weightlifting exercises do --
  // they're arbitrary, gym-assigned names -- so in climbing mode only suggest what this account
  // has actually logged before, without merging in the (irrelevant) weightlifting exercise list.
  // Preset names (see Settings > Exercise presets) count as "known" in both modes, same as
  // logged history -- they're exactly the kind of thing worth autocompleting too.
  const presetNames = useMemo(
    () => categories.flatMap((c) => c.presets.map((p) => p.name)),
    [categories]
  );
  const exerciseSuggestions = useMemo(
    () =>
      climbingMode
        ? Array.from(new Set([...loggedExercises, ...presetNames]))
        : Array.from(new Set([...loggedExercises, ...presetNames, ...COMMON_EXERCISES])),
    [loggedExercises, presetNames, climbingMode]
  );
  const tagSuggestions = useMemo(
    () =>
      Array.from(
        new Set([...loggedTags, ...(climbingMode ? COMMON_CLIMBING_TAGS : COMMON_TAGS)])
      ),
    [loggedTags, climbingMode]
  );
  const gymSuggestions = useMemo(() => Array.from(new Set(loggedGyms)), [loggedGyms]);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setVideoError("Please choose a video file.");
      return;
    }
    if (file.size > maxUploadBytes) {
      setVideoError(
        `That file is over ${formatMaxSize(maxUploadBytes)}. Try trimming it, or paste a YouTube link instead.`
      );
      return;
    }

    setVideoError(null);
    setVideoUrl("");
    setDurationDetected(false);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);

    if (mode === "create") {
      extractVideoCreationDate(file).then((date) => {
        if (date && !dateManuallyEditedRef.current) {
          setRecordedAt(toDateInputValue(date.toISOString()));
        }
      });
    }

    let uploadFile = file;
    setCompressing(true);
    setCompressionProgress(0);
    try {
      const result = await compressVideo(file, (ratio) => setCompressionProgress(ratio * 100));
      // Only keep the compressed version if it's actually smaller -- an already-efficient
      // source file can occasionally come out larger after a lossy re-encode, and there's no
      // point uploading a bigger "compressed" file.
      if (result.compressedBytes < result.originalBytes) {
        uploadFile = result.file;
      }
    } catch (err) {
      // Compression is a nice-to-have, not a requirement -- fall back to the original file
      // rather than blocking the user from logging their set.
      console.error("Video compression failed, uploading the original file instead:", err);
    } finally {
      setCompressing(false);
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await upload(`${userId}/${uploadFile.name}`, uploadFile, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });
      setVideoUrl(result.url);
      toast.success("Video uploaded");
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [userId, mode, maxUploadBytes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: uploading || compressing,
  });

  function handleVideoMetadataLoaded() {
    const video = hiddenVideoRef.current;
    if (video && Number.isFinite(video.duration)) {
      setDurationSec(Math.round(video.duration));
      setDurationDetected(true);
    }
  }

  function handleYoutubeInputChange(value: string) {
    setYoutubeInput(value);
    const id = extractYouTubeId(value);
    if (id) {
      setYoutubeId(id);
      setVideoUrl(value.trim());
      setVideoError(null);
    } else {
      setYoutubeId(null);
      setVideoUrl("");
      if (value.trim()) setVideoError("Doesn't look like a valid YouTube link.");
      else setVideoError(null);
    }
  }

  function clearVideo() {
    setVideoUrl("");
    setYoutubeId(null);
    setYoutubeInput("");
    setFilePreview(null);
    setDurationSec(null);
    setDurationDetected(false);
    setVideoError(null);
  }

  const minutes = durationSec != null ? Math.floor(durationSec / 60) : "";
  const seconds = durationSec != null ? durationSec % 60 : "";

  function updateDuration(min: string, sec: string) {
    const m = Number(min) || 0;
    const s = Number(sec) || 0;
    if (!min && !sec) {
      setDurationSec(null);
      return;
    }
    setDurationSec(m * 60 + s);
    setDurationDetected(false);
  }

  const canSubmit = useMemo(() => {
    const climbingFieldsOk = !climbingMode || Boolean(gym.trim() && grade !== "");
    return Boolean(
      exerciseName.trim() && recordedAt && climbingFieldsOk && (!replacingVideo || videoUrl)
    );
  }, [exerciseName, recordedAt, replacingVideo, videoUrl, climbingMode, gym, grade]);

  /** Validates and saves, returning the saved entry on success or null on failure (already
   *  toasted) -- shared by both "Save entry" and "Save & log another", which only differ in what
   *  happens after a successful save. */
  async function submitEntry(): Promise<WorkoutEntry | null> {
    if (!exerciseName.trim()) {
      toast.error(climbingMode ? "Give the route or problem a name first." : "Give the exercise a name first.");
      return null;
    }
    if (climbingMode && (!gym.trim() || grade === "")) {
      toast.error("Add a gym and a grade first.");
      return null;
    }
    if (replacingVideo && !videoUrl) {
      toast.error("Add a video — upload a file or paste a YouTube link — before saving.");
      return null;
    }

    const payload = {
      exerciseName: exerciseName.trim(),
      weight: climbingMode ? null : weight ? Number(weight) : null,
      gym: climbingMode ? gym.trim() : null,
      grade: climbingMode && grade !== "" ? Number(grade) : null,
      recordedAt: new Date(recordedAt).toISOString(),
      videoSource,
      videoUrl: replacingVideo ? videoUrl : initialData!.videoUrl,
      youtubeId: replacingVideo ? (videoSource === "YOUTUBE" ? youtubeId : null) : initialData!.youtubeId,
      durationSec: replacingVideo ? durationSec : initialData!.durationSec,
      sets: sets ? Number(sets) : null,
      reps: reps ? Number(reps) : null,
      tags,
      difficulty,
      notes: notes.trim() || null,
      isFavorite,
      succeeded,
      fulfillsPlanId: mode === "create" ? (fromPlan?.id ?? null) : undefined,
      videos: additionalVideos.map(({ videoSource: vs, videoUrl: vu, youtubeId: yid, durationSec: ds }) => ({
        videoSource: vs,
        videoUrl: vu,
        youtubeId: yid,
        durationSec: ds,
      })),
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/entries" : `/api/entries/${initialData!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error("Could not save this entry. Please try again.");
      }

      return (await res.json()) as WorkoutEntry;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmittingAction("save");
    try {
      const saved = await submitEntry();
      if (!saved) return;
      toast.success(mode === "create" ? "Set logged!" : "Changes saved");
      router.push(`/entries/${saved.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  }

  /** Saves the current entry, then clears just the video (keeping the exercise, date, gym,
   *  grade/weight, sets/reps, tags, etc. as-is) so the next attempt's video can be logged right
   *  away instead of retyping everything -- for logging several videos of the same exercise back
   *  to back. */
  async function handleSaveAndAddAnother() {
    setSubmitting(true);
    setSubmittingAction("save-and-another");
    try {
      const saved = await submitEntry();
      if (!saved) return;
      setLoggedCount((n) => n + 1);
      clearVideo();
      // The extra videos just attached belong to the entry that was just saved -- they'd
      // otherwise carry over and end up referenced by the next entry too.
      setAdditionalVideos([]);
      setAddingVideo(false);
      toast.success(`Set logged (${loggedCount + 1} so far) — add the next video.`);
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Video</h2>

        {!replacingVideo && initialData && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Film className="size-4" />
                Keeping the current video for this entry.
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReplacingVideo(true);
                  if (!uploadsEnabled) setVideoSource("YOUTUBE");
                }}
              >
                Replace video
              </Button>
            </CardContent>
          </Card>
        )}

        {replacingVideo && (
          <div className="space-y-3">
            {uploadsEnabled ? (
              <Tabs
                value={videoSource}
                onValueChange={(v) => {
                  setVideoSource(v as VideoSource);
                  clearVideo();
                }}
              >
                <TabsList>
                  <TabsTrigger value="UPLOAD">
                    <UploadCloud className="size-4" /> Upload a file
                  </TabsTrigger>
                  <TabsTrigger value="YOUTUBE">
                    <Link2 className="size-4" /> Paste YouTube link
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <p className="text-xs text-muted-foreground">
                Direct video uploads are currently turned off — paste a YouTube link instead.
              </p>
            )}

            {uploadsEnabled && videoSource === "UPLOAD" && (
              <div className="space-y-3">
                {!filePreview ? (
                  <div
                    {...getRootProps()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                      isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud className="size-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Drag & drop your video, or click to browse</p>
                    <p className="text-xs text-muted-foreground">
                      MP4, MOV, or WebM up to {formatMaxSize(maxUploadBytes)} — compressed
                      automatically before upload.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative overflow-hidden rounded-xl border bg-black">
                      <video
                        ref={hiddenVideoRef}
                        src={filePreview}
                        controls
                        onLoadedMetadata={handleVideoMetadataLoaded}
                        className="max-h-80 w-full"
                      />
                    </div>
                    {compressing && (
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${compressionProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Compressing… {Math.round(compressionProgress)}%
                        </p>
                      </div>
                    )}
                    {uploading && (
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Uploading… {Math.round(uploadProgress)}%</p>
                      </div>
                    )}
                    {!uploading && videoUrl && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">Uploaded ✓</p>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={clearVideo}>
                      <X className="size-3.5" /> Choose a different file
                    </Button>
                  </div>
                )}
              </div>
            )}

            {videoSource === "YOUTUBE" && (
              <div className="space-y-3">
                <Input
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={youtubeInput}
                  onChange={(e) => handleYoutubeInputChange(e.target.value)}
                />
                {youtubeId && (
                  <div className="aspect-video overflow-hidden rounded-xl border">
                    <iframe
                      className="h-full w-full"
                      src={youtubeEmbedUrl(youtubeId)}
                      title="YouTube preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            )}

            {videoError && <p className="text-sm text-destructive">{videoError}</p>}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <Label>Additional videos (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Attach more clips to this same log — a different angle, or another attempt.
          </p>

          {additionalVideos.length > 0 && (
            <ul className="space-y-1.5">
              {additionalVideos.map((v, i) => (
                <li
                  key={v.key}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Film className="size-3.5" /> Video {i + 2} —{" "}
                    {v.videoSource === "YOUTUBE" ? "YouTube" : "Uploaded"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove video ${i + 2}`}
                    onClick={() =>
                      setAdditionalVideos((prev) => prev.filter((x) => x.key !== v.key))
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {addingVideo ? (
            <AdditionalVideoSlot
              uploadsEnabled={uploadsEnabled}
              maxUploadBytes={maxUploadBytes}
              userId={userId}
              onCancel={() => setAddingVideo(false)}
              onSave={(video) => {
                setAdditionalVideos((prev) => [
                  ...prev,
                  { key: `${Date.now()}-${prev.length}`, ...video },
                ]);
                setAddingVideo(false);
              }}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAddingVideo(true)}>
              <Film className="size-3.5" /> Add another video
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exerciseName">{climbingMode ? "Route / problem" : "Exercise"}</Label>
          {categories.some((c) => c.presets.length > 0) && (
            <Select
              value=""
              onValueChange={(id) => {
                const preset = id && findExercisePreset(categories, id);
                if (!preset) return;
                setExerciseName(preset.name);
                setWeight(preset.weight != null ? String(preset.weight) : "");
                setGrade(preset.grade != null ? String(preset.grade) : "");
                setSets(preset.sets != null ? String(preset.sets) : "");
                setReps(preset.reps != null ? String(preset.reps) : "");
                setNotes(preset.notes ?? "");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={climbingMode ? "Choose a preset route…" : "Choose a preset exercise…"}
                />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.presets.length > 0)
                  .map((category) => (
                    <SelectGroup key={category.id}>
                      <SelectLabel>{category.name}</SelectLabel>
                      {category.presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          )}
          <AutocompleteInput
            id="exerciseName"
            value={exerciseName}
            onChange={setExerciseName}
            suggestions={exerciseSuggestions}
            placeholder={climbingMode ? "e.g. Blue arête (optional detail)" : "Barbell Squat"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recordedAt">Date</Label>
          <Input
            id="recordedAt"
            type="date"
            value={recordedAt}
            onChange={(e) => {
              setRecordedAt(e.target.value);
              dateManuallyEditedRef.current = true;
            }}
            required
          />
        </div>

        {climbingMode ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="gym">Gym</Label>
              <AutocompleteInput
                id="gym"
                value={gym}
                onChange={setGym}
                suggestions={gymSuggestions}
                placeholder="e.g. Movement, Brooklyn Boulders"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Grade</Label>
              <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                <SelectTrigger id="grade" className="w-full">
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {formatGrade(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (optional)</Label>
            <Input
              id="weight"
              type="number"
              min={0}
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 135 (leave blank for bodyweight)"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="sets">{climbingMode ? "Attempts" : "Sets"}</Label>
            <Input
              id="sets"
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reps">{climbingMode ? "Sets" : "Reps"}</Label>
            <Input
              id="reps"
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>Duration</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            className="w-20"
            placeholder="min"
            value={minutes}
            onChange={(e) => updateDuration(e.target.value, String(seconds))}
          />
          <span className="text-muted-foreground">min</span>
          <Input
            type="number"
            min={0}
            max={59}
            className="w-20"
            placeholder="sec"
            value={seconds}
            onChange={(e) => updateDuration(String(minutes), e.target.value)}
          />
          <span className="text-muted-foreground">sec</span>
          {durationDetected && durationSec != null && (
            <span className="text-xs text-muted-foreground">
              (auto-detected — {formatDuration(durationSec)})
            </span>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <Label>Perceived exertion (self-rated)</Label>
        <ExertionPicker value={difficulty} onChange={setDifficulty} />
      </section>

      <section className="space-y-2">
        <Label>Tags</Label>
        <TagInput
          value={tags}
          onChange={setTags}
          placeholder={climbingMode ? "Bouldering, crimpy, overhang…" : "Push, legs, cardio…"}
          suggestions={tagSuggestions}
        />
      </section>

      <section className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={5}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What went well? What needs work next time?"
        />
      </section>

      <section className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="succeeded">{climbingMode ? "Sent it" : "Completed successfully"}</Label>
          <p className="text-sm text-muted-foreground">
            {climbingMode
              ? "Turn off if you didn't send — it'll still show up in your library, just not in records."
              : "Turn off if you missed the lift — it'll still show up in your library, just not in records."}
          </p>
        </div>
        <Switch id="succeeded" checked={succeeded} onCheckedChange={setSucceeded} />
      </section>

      <section className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="favorite">Milestone / favorite set</Label>
          <p className="text-sm text-muted-foreground">Mark this as a set worth revisiting.</p>
        </div>
        <Switch id="favorite" checked={isFavorite} onCheckedChange={setIsFavorite} />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        {mode === "create" && (
          <Button
            type="button"
            variant="secondary"
            disabled={!canSubmit || submitting || uploading || compressing}
            onClick={handleSaveAndAddAnother}
          >
            {submittingAction === "save-and-another" && <Loader2 className="size-4 animate-spin" />}
            Save &amp; log another video
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit || submitting || uploading || compressing}>
          {submittingAction === "save" && <Loader2 className="size-4 animate-spin" />}
          {mode === "create" ? "Save entry" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
