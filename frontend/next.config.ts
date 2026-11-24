import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

const codespaceOrigin =
  codespaceName && forwardingDomain
    ? `${codespaceName}-3000.${forwardingDomain}`
    : null;

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
    ...(codespaceOrigin ? [codespaceOrigin] : []),
  ],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
