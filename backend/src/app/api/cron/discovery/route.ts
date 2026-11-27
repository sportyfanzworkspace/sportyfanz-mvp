import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import {
  scheduleDiscoveryJobs,
} from "@/lib/discovery/sync/scheduler";

import {
  executeNextDiscoveryJob,
} from "@/lib/discovery/sync/worker";

import {
  recoverExpiredJobs,
} from "@/lib/discovery/sync/jobs";

import {
  getDiscoveryPool,
} from "@/lib/discovery/sync/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);

  const supplied = Buffer.from(
    request.headers.get("authorization") ?? ""
  );

  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  if (
    process.env.DISCOVERY_WORKER_ENABLED !== "true"
  ) {
    return NextResponse.json({
      enabled: false,
      message: "Discovery automation is disabled.",
    });
  }

  const client = await getDiscoveryPool().connect();

  let locked = false;
  let discard = false;

  try {
    const lock = await client.query<{
      acquired: boolean;
    }>(`
      SELECT pg_try_advisory_lock(
        74924, 12001
      ) AS acquired
    `);

    locked = lock.rows[0].acquired;

    if (!locked) {
      return NextResponse.json({
        enabled: true,
        skipped: true,
        message: "Discovery automation already running.",
      });
    }

    await recoverExpiredJobs();

    const scheduling = await scheduleDiscoveryJobs();

    const worker = await executeNextDiscoveryJob();

    return NextResponse.json({
      enabled: true,
      scheduling,
      worker,
    });

  } catch {
    return NextResponse.json(
      { error: "Discovery automation failed." },
      { status: 500 }
    );

  } finally {
    try {
      if (locked) {
        await client.query(`
          SELECT pg_advisory_unlock(
            74924, 12001
          )
        `);
      }
    } catch {
      discard = true;
    } finally {
      client.release(discard);
    }
  }
}
