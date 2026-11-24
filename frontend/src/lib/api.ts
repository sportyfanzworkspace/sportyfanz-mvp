const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return API_BASE_URL
    ? `${API_BASE_URL}${normalizedPath}`
    : normalizedPath;
}

export function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...options,
    credentials: options.credentials ?? "include",
  });
}
