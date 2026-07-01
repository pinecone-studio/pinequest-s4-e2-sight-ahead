import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yt-search (and its cheerio dependency) run server-side, not bundled.
  serverExternalPackages: ["yt-search", "cheerio"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ytimg.com", // i.ytimg.com, i1-i9.ytimg.com, etc.
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
