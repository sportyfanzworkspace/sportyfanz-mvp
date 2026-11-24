import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:3101/api/:path*",
            },
          ];
        },
      }
    : {
        output: "export" as const,
      }),
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "cautious-train-gw7vjpwgqwx3vw4r-3000.app.github.dev",
  ],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
