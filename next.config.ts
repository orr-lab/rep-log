import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The AI-feedback route spawns the bundled yt-dlp binary via a runtime-constructed path
  // (not a JS import), so Next's automatic file tracer won't pick it up on its own.
  outputFileTracingIncludes: {
    "/api/entries/[id]/ai-feedback/route": ["./bin/yt-dlp"],
  },
};

export default nextConfig;
