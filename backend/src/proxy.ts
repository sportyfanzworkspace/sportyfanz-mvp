import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = new Set([
  "https://www.sportyfanz.com",
  "https://sportyfanz.com",
  ...(process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]
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
    "Content-Type, Authorization, X-Image-Category",
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

  // Reject cross-origin mutations against cookie-authenticated
  // staff endpoints before they reach the route handler.
  const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(
    request.method
  );

  const staffMutation =
    request.nextUrl.pathname.startsWith("/api/admin/") &&
    unsafeMethod;

  const csrfExemptPaths = new Set([
    "/api/admin/set-password",
  ]);

  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "");

  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized =
    normalizedPath === "/api/admin/fixtures/sync" &&
    Boolean(cronSecret) &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (
    staffMutation &&
    !csrfExemptPaths.has(normalizedPath) &&
    !cronAuthorized
  ) {
    // Cookie-authenticated staff mutations require an
    // explicitly trusted browser origin.
    if (!isAllowedOrigin) {
      return NextResponse.json(
        {
          error: "Request origin is not permitted.",
          code: "INVALID_REQUEST_ORIGIN",
        },
        { status: 403 }
      );
    }
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
