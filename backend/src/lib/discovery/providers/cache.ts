import type {
  ProviderParameters,
} from "./client";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const DISCOVERY_CACHE_TTL = {
  countries: 30 * DAY,
  leagues: 7 * DAY,
  competitions: 7 * DAY,
  teams: 7 * DAY,
  players: 7 * DAY,
  "players/profiles": 7 * DAY,
  "players/squads": DAY,
  squads: DAY,
  transfers: DAY,
  "players/statistics": DAY,
  standings: 6 * HOUR,
  default: HOUR,
} as const;

export function getDiscoveryCacheTtl(
  endpoint: string
): number {
  const key = endpoint.replace(/^\/+|\/+$/g, "");

  if (
    Object.prototype.hasOwnProperty.call(
      DISCOVERY_CACHE_TTL,
      key
    )
  ) {
    return DISCOVERY_CACHE_TTL[
      key as keyof typeof DISCOVERY_CACHE_TTL
    ];
  }

  return DISCOVERY_CACHE_TTL.default;
}

export function createProviderCacheKey(
  providerName: string,
  endpoint: string,
  parameters: ProviderParameters = {}
): string {
  const normalized = Object.entries(parameters)
    .filter(([, value]) =>
      value !== null && value !== undefined
    )
    .map(([key, value]) =>
      [key, String(value)] as const
    )
    .sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    );

  return JSON.stringify([
    providerName,
    endpoint,
    normalized,
  ]);
}

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  bytes: number;
};

export type CacheResult<T> = {
  data: T;
  source: "CACHE" | "FETCH" | "SHARED_REQUEST";
};

export class DiscoveryProviderCache {
  private readonly entries =
    new Map<string, CacheEntry>();

  private readonly inFlight =
    new Map<string, Promise<unknown>>();

  private totalBytes = 0;

  private readonly invalidatedRequests =
    new Set<Promise<unknown>>();

  constructor(
    private readonly maxEntries = 250,
    private readonly maxBytes = 32 * 1024 * 1024,
    private readonly maxInFlight = 10,
    private readonly clock: () => number = Date.now
  ) {
    for (const limit of [
      maxEntries,
      maxBytes,
      maxInFlight,
    ]) {
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1
      ) {
        throw new Error("Invalid cache limit.");
      }
    }
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);

    if (!entry) {
      return;
    }

    this.totalBytes -= entry.bytes;
    this.entries.delete(key);
  }

  pruneExpired(): number {
    const now = this.clock();
    let removed = 0;

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.remove(key);
        removed++;
      }
    }

    return removed;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.clock()) {
      this.remove(key);
      return undefined;
    }

    // Move recently accessed entries to the end.
    this.entries.delete(key);
    this.entries.set(key, entry);

    return structuredClone(entry.value) as T;
  }

  set<T>(
    key: string,
    value: T,
    ttlMs: number
  ): boolean {
    if (
      !Number.isSafeInteger(ttlMs) ||
      ttlMs <= 0 ||
      value === undefined
    ) {
      return false;
    }

    let bytes: number;
    let stored: T;

    try {
      const serialized = JSON.stringify(value);

      if (serialized === undefined) {
        return false;
      }

      bytes =
        Buffer.byteLength(serialized, "utf8") +
        Buffer.byteLength(key, "utf8");

      stored = structuredClone(value);
    } catch {
      return false;
    }

    if (bytes > this.maxBytes) {
      return false;
    }

    this.pruneExpired();
    this.remove(key);

    while (
      this.entries.size >= this.maxEntries ||
      this.totalBytes + bytes > this.maxBytes
    ) {
      const oldest =
        this.entries.keys().next().value;

      if (oldest === undefined) {
        return false;
      }

      this.remove(oldest);
    }

    this.entries.set(key, {
      value: stored,
      expiresAt: this.clock() + ttlMs,
      bytes,
    });

    this.totalBytes += bytes;

    return true;
  }

  invalidate(key: string): void {
    this.remove(key);

    // Prevent an invalidated request from
    // repopulating the cache when it completes.
    const pending = this.inFlight.get(key);

    if (pending) {
      this.invalidatedRequests.add(pending);
    }
  }

  clear(): void {
    this.entries.clear();

    for (const pending of this.inFlight.values()) {
      this.invalidatedRequests.add(pending);
    }

    this.totalBytes = 0;
  }

  stats() {
    this.pruneExpired();

    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      inFlight: this.inFlight.size,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
    };
  }

  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<CacheResult<T>> {
    const cached = this.get<T>(key);

    if (cached !== undefined) {
      return {
        data: cached,
        source: "CACHE",
      };
    }

    const existing = this.inFlight.get(key);

    if (existing) {
      if (this.invalidatedRequests.has(existing)) {
        throw new Error(
          "Invalidated provider request is still completing."
        );
      }

      return {
        data: structuredClone(await existing) as T,
        source: "SHARED_REQUEST",
      };
    }

    if (this.inFlight.size >= this.maxInFlight) {
      throw new Error(
        "Discovery provider cache is busy."
      );
    }

    const pending = Promise.resolve()
      .then(loader);

    this.inFlight.set(key, pending);

    try {
      const data = await pending;

      if (
        this.inFlight.get(key) === pending &&
        !this.invalidatedRequests.has(pending)
      ) {
        this.set(key, data, ttlMs);
      }

      return {
        data: structuredClone(data),
        source: "FETCH",
      };
    } finally {
      this.invalidatedRequests.delete(pending);

      if (this.inFlight.get(key) === pending) {
        this.inFlight.delete(key);
      }
    }
  }
}

export const discoveryProviderCache =
  new DiscoveryProviderCache();
