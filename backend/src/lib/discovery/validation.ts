export class DiscoveryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryValidationError";
  }
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createDiscoverySlug(value: string): string {
  const slug = normalizeSearch(value)
    .replace(/\s+/g, "-");

  if (!slug || slug.length > 180) {
    throw new DiscoveryValidationError(
      "Unable to generate a valid profile slug."
    );
  }

  return slug;
}

export function requiredText(
  value: unknown,
  label: string,
  maxLength = 150
): string {
  if (typeof value !== "string") {
    throw new DiscoveryValidationError(
      `${label} is required.`
    );
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    throw new DiscoveryValidationError(
      `${label} must contain 1 to ${maxLength} characters.`
    );
  }

  return text;
}

export function optionalText(
  value: unknown,
  label: string,
  maxLength = 500
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new DiscoveryValidationError(
      `${label} must be text.`
    );
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new DiscoveryValidationError(
      `${label} must not exceed ${maxLength} characters.`
    );
  }

  return text || null;
}

export function optionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new DiscoveryValidationError(
      `${label} must be a whole number.`
    );
  }

  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new DiscoveryValidationError(
      `${label} must be a whole number.`
    );
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  ) {
    throw new DiscoveryValidationError(
      `${label} must be between ${min} and ${max}.`
    );
  }

  return number;
}

export function requiredId(
  value: unknown,
  label: string
): number {
  const id = optionalInteger(
    value,
    label,
    1,
    2147483647
  );

  if (id === null) {
    throw new DiscoveryValidationError(
      `${label} is required.`
    );
  }

  return id;
}

export function optionalHttpsUrl(
  value: unknown,
  label: string
): string | null {
  const text = optionalText(value, label, 2048);

  if (!text) return null;

  let url: URL;

  try {
    url = new URL(text);
  } catch {
    throw new DiscoveryValidationError(
      `${label} must be a valid URL.`
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password
  ) {
    throw new DiscoveryValidationError(
      `${label} must be a valid HTTPS URL.`
    );
  }

  return url.toString();
}

export function optionalDateOfBirth(
  value: unknown
): string | null {
  const text = optionalText(value, "Date of birth", 10);

  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new DiscoveryValidationError(
      "Date of birth must use YYYY-MM-DD."
    );
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text ||
    text > new Date().toISOString().slice(0, 10)
  ) {
    throw new DiscoveryValidationError(
      "Date of birth is invalid."
    );
  }

  return text;
}

export function publicationStatus(value: unknown) {
  if (
    value !== "DRAFT" &&
    value !== "PUBLISHED" &&
    value !== "ARCHIVED"
  ) {
    throw new DiscoveryValidationError(
      "Invalid publication status."
    );
  }

  return value;
}
