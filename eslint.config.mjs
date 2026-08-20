import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored ffmpeg.wasm core glue code (copied from @ffmpeg/core's and @ffmpeg/core-mt's
    // build output into public/ so it's self-hosted, see src/lib/video-compress.ts) --
    // generated/minified third-party output, not something to hold to this project's lint rules.
    "public/ffmpeg/**",
    "public/ffmpeg-mt/**",
  ]),
  {
    // Standalone CommonJS scripts run directly via `node scripts/*.js`, outside the Next.js
    // module graph — require() here is intentional, not a stray CommonJS import to flag.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
