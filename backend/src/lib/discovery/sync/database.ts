import { Pool } from "pg";

const globalForDiscovery = globalThis as typeof globalThis & {
  sportyFanzDiscoveryPool?: Pool;
};

export function getDiscoveryPool(): Pool {
  if (!globalForDiscovery.sportyFanzDiscoveryPool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not configured."
      );
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 20000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 30000,
    });

    pool.on("error", () => {
      console.error(
        "Discovery database pool connection error."
      );
    });

    globalForDiscovery.sportyFanzDiscoveryPool = pool;
  }

  return globalForDiscovery.sportyFanzDiscoveryPool;
}
