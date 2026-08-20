import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The AI-feedback route spawns the bundled yt-dlp binary via a runtime-constructed path
  // (not a JS import), so Next's automatic file tracer won't pick it up on its own.
  outputFileTracingIncludes: {
    "/api/entries/[id]/ai-feedback/route": ["./bin/yt-dlp"],
  },
  // Cross-origin isolation, needed for the multi-threaded ffmpeg.wasm core (see
  // src/lib/video-compress.ts) -- SharedArrayBuffer, which multi-threaded WASM requires, is only
  // available on a crossOriginIsolated page. COEP uses `credentialless` rather than the stricter
  // `require-corp` specifically so the YouTube iframe embed in VideoPlayer, and any other
  // cross-origin subresource, keeps loading without needing to opt in via its own CORP header --
  // browsers that don't support `credentialless` just end up not cross-origin isolated, which
  // video-compress.ts already treats as a normal fallback to its single-threaded core.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
