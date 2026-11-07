import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = new Set([
  "https://www.sportyfanz.com",
  "https://sportyfanz.com",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
  ...(process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
]);

const corsHeaders = {
  "Access-Control-Allow-Methods":
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = allowedOrigins.has(origin);

  // Handle browser CORS preflight requests before they reach API routes.
  if (request.method === "OPTIONS") {
    const headers = new Headers({
      Vary: "Origin",
    });

    if (isAllowedOrigin) {
      headers.set("Access-Control-Allow-Origin", origin);

      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    return new NextResponse(null, {
      status: 204,
      headers,
    });
  }

  // Continue to the original API route.
  const response = NextResponse.next();

  response.headers.append("Vary", "Origin");

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
