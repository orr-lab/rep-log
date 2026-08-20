"use client";

import { useMemo, useRef, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/youtube";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { VideoSource, WorkoutEntry } from "@/lib/types";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlayableVideo {
  videoSource: VideoSource;
  videoUrl: string;
  youtubeId: string | null;
}

export function VideoPlayer({ entry }: { entry: WorkoutEntry }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState("1");
  const [activeIndex, setActiveIndex] = useState(0);

  // The primary video (videoSource/videoUrl/youtubeId, always present) followed by any extra
  // ones attached via "Add another video" -- most entries have just the one, in which case this
  // renders identically to before (no selector row).
  const videos: PlayableVideo[] = useMemo(
    () => [
      { videoSource: entry.videoSource, videoUrl: entry.videoUrl, youtubeId: entry.youtubeId },
      ...(entry.videos ?? []).map((v) => ({
        videoSource: v.videoSource,
        videoUrl: v.videoUrl,
        youtubeId: v.youtubeId,
      })),
    ],
    [entry]
  );
  const active = videos[activeIndex] ?? videos[0];

  return (
    <div className="space-y-2">
      {active.videoSource === "YOUTUBE" && active.youtubeId ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
          <iframe
            className="h-full w-full"
            src={youtubeEmbedUrl(active.youtubeId)}
            title={entry.exerciseName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-black">
          <video
            ref={videoRef}
            src={active.videoUrl}
            controls
            className="max-h-[70vh] w-full"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {active.videoSource === "UPLOAD" && (
          <>
            <span className="text-sm text-muted-foreground">Playback speed</span>
            <Select
              value={speed}
              onValueChange={(v) => {
                if (!v) return;
                setSpeed(v);
                if (videoRef.current) videoRef.current.playbackRate = Number(v);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEEDS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {videos.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {videos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                i === activeIndex
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              Video {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
