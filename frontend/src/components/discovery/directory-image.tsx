"use client";

import {
  useState,
  type ReactNode,
} from "react";

function validImageUrl(
  value?: string | null
): string | null {
  const candidate = value?.trim();

  if (!candidate) return null;

  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\\\")
  ) {
    return candidate;
  }

  try {
    const url = new URL(candidate);

    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    ) {
      return url.href;
    }
  } catch {
    // Non-URL values use the supplied fallback.
  }

  return null;
}

export default function DirectoryImage({
  url,
  fallback,
  size,
  circular = false,
}: {
  url?: string | null;
  fallback: ReactNode;
  size?: number;
  circular?: boolean;
}) {
  const imageUrl = validImageUrl(url);

  const [failedUrl, setFailedUrl] =
    useState<string | null>(null);

  if (!imageUrl || failedUrl === imageUrl) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(imageUrl)}
      style={{
        width: size ?? "100%",
        height: size ?? "100%",
        objectFit: circular ? "cover" : "contain",
        borderRadius: circular ? "50%" : undefined,
      }}
    />
  );
}
