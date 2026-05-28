/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@cut/core"],
  // The desktop bundle ships a static `out/` directory served by Electron;
  // web deploys keep the standard `next start` flow with header support.
  ...(isExport ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  experimental: {
    // SharedArrayBuffer needed by ffmpeg.wasm; set COOP/COEP headers in middleware.
  },
  // `headers()` is a no-op in static export — the Electron shell injects the
  // same COOP/COEP headers on every response so SharedArrayBuffer keeps working.
  ...(isExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
