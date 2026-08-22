"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { UploadCloud, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractYouTubeId } from "@/lib/youtube";
import { compressVideo } from "@/lib/video-compress";
import type { VideoSource } from "@/lib/types";

function formatMaxSize(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export interface SavedAdditionalVideo {
  videoSource: VideoSource;
  videoUrl: string;
  youtubeId: string | null;
  durationSec: number | null;
}

/** A single "add another video" upload/YouTube-link flow, scoped to its own local state -- a
 *  compact sibling of the primary video section on WorkoutEntryForm, reusing the same
 *  compress-then-upload pipeline. One of these is mounted at a time (see additionalVideos +
 *  addingVideo on WorkoutEntryForm). `onSave` fires automatically as soon as the video is ready
 *  (upload finishes, or a valid YouTube link is pasted) -- there's no separate confirm step,
 *  since requiring one turned out to be an easy way to lose a video entirely: a user would drop
 *  the file, see it upload successfully, then hit "Save entry" without noticing there was still
 *  a manual "Add video" button to click, and the video was never attached to the entry at all. */
export function AdditionalVideoSlot({
  uploadsEnabled,
  maxUploadBytes,
  userId,
  onSave,
  onCancel,
}: {
  uploadsEnabled: boolean;
  maxUploadBytes: number;
  userId: string;
  onSave: (video: SavedAdditionalVideo) => void;
  onCancel: () => void;
}) {
  const [videoSource, setVideoSource] = useState<VideoSource>(uploadsEnabled ? "UPLOAD" : "YOUTUBE");
  const [videoUrl, setVideoUrl] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  // Mirrors durationSec for onDrop's async closure to read -- the closure captures whatever
  // durationSec was when onDrop (memoized via useCallback) was created, which can be stale by
  // the time the upload actually finishes; a ref always reads the latest value.
  const durationSecRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        setError("Please choose a video file.");
        return;
      }
      if (file.size > maxUploadBytes) {
        setError(
          `That file is over ${formatMaxSize(maxUploadBytes)}. Try trimming it, or paste a YouTube link instead.`
        );
        return;
      }

      setError(null);
      setVideoUrl("");
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);

      let uploadFile = file;
      setCompressing(true);
      setCompressionProgress(0);
      const compressStart = performance.now();
      try {
        const result = await compressVideo(file, (ratio) => setCompressionProgress(ratio * 100));
        const seconds = ((performance.now() - compressStart) / 1000).toFixed(1);
        toast.message(
          `Compressed via ${result.method} in ${seconds}s` +
            (result.fallbackReason ? ` (webcodecs failed: ${result.fallbackReason})` : ""),
          // Stays on screen until manually dismissed -- the "Video uploaded" toast that follows
          // right after would otherwise push this off-screen before there's time to read it.
          { duration: Infinity }
        );
        if (result.compressedBytes < result.originalBytes) {
          uploadFile = result.file;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Video compression failed, uploading the original file instead:", err);
        toast.message(`Compression failed, uploading original file: ${message}`, { duration: Infinity });
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
        onSave({
          videoSource: "UPLOAD",
          videoUrl: result.url,
          youtubeId: null,
          durationSec: durationSecRef.current,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [userId, maxUploadBytes, onSave]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: uploading || compressing,
  });

  function handleVideoMetadataLoaded() {
    const video = hiddenVideoRef.current;
    if (video && Number.isFinite(video.duration)) {
      durationSecRef.current = Math.round(video.duration);
    }
  }

  function handleYoutubeInputChange(value: string) {
    setYoutubeInput(value);
    const id = extractYouTubeId(value);
    if (id) {
      setVideoUrl(value.trim());
      setError(null);
      onSave({ videoSource: "YOUTUBE", videoUrl: value.trim(), youtubeId: id, durationSec: null });
    } else {
      setVideoUrl("");
      setError(value.trim() ? "Doesn't look like a valid YouTube link." : null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      {uploadsEnabled ? (
        <Tabs
          value={videoSource}
          onValueChange={(v) => {
            setVideoSource(v as VideoSource);
            setVideoUrl("");
            setYoutubeInput("");
            setFilePreview(null);
            setError(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="UPLOAD">
              <UploadCloud className="size-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="YOUTUBE">
              <Link2 className="size-4" /> YouTube link
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <p className="text-xs text-muted-foreground">
          Direct video uploads are currently turned off — paste a YouTube link instead.
        </p>
      )}

      {uploadsEnabled && videoSource === "UPLOAD" && (
        <div className="space-y-2">
          {!filePreview ? (
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="size-6 text-muted-foreground" />
              <p className="text-xs font-medium">Drag & drop, or click to browse</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg border bg-black">
                <video
                  ref={hiddenVideoRef}
                  src={filePreview}
                  controls
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  className="max-h-56 w-full"
                />
              </div>
              {compressing && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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
            </div>
          )}
        </div>
      )}

      {videoSource === "YOUTUBE" && (
        <Input
          placeholder="https://www.youtube.com/watch?v=…"
          value={youtubeInput}
          onChange={(e) => handleYoutubeInputChange(e.target.value)}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
