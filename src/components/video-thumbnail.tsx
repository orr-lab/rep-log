import { Play } from "lucide-react";
import { youtubeThumbnailUrl } from "@/lib/youtube";
import type { WorkoutEntry } from "@/lib/types";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoThumbnail({ entry }: { entry: WorkoutEntry }) {
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      {entry.videoSource === "YOUTUBE" && entry.youtubeId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={youtubeThumbnailUrl(entry.youtubeId)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <video
          src={`${entry.videoUrl}#t=0.5`}
          preload="metadata"
          muted
          className="h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
        <div className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Play className="size-4 translate-x-0.5 fill-white" />
        </div>
      </div>
      {entry.durationSec != null && (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(entry.durationSec)}
        </span>
      )}
    </div>
  );
}
