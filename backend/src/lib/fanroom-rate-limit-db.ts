import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  sportyFanzFanRoomRateLimitPool?: Pool;
};

export function getFanRoomRateLimitPool(): Pool {
  if (!globalForPg.sportyFanzFanRoomRateLimitPool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured.");
    }

    globalForPg.sportyFanzFanRoomRateLimitPool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
  }

  return globalForPg.sportyFanzFanRoomRateLimitPool;
}
