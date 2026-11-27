import {
  loadAdminDirectory,
} from "@/lib/discovery/admin-directory";

import {
  DirectoryQueryError,
} from "@/lib/discovery/directory-pagination";

import { NextResponse } from "next/server";
import {
  requirePermission,
  hasPermission,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import {
  DiscoveryValidationError,
  requiredText,
  optionalText,
  optionalInteger,
  optionalHttpsUrl,
  requiredId,
  createDiscoverySlug,
  publicationStatus,
} from "@/lib/discovery/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function handleError(error: unknown) {
  if (error instanceof DiscoveryValidationError) {
    return fail(error.message);
  }

  if (error instanceof SyntaxError) {
    return fail("Invalid JSON request.");
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "23505" || error.code === "P2002")
  ) {
    return fail("A conflicting directory record already exists.", 409);
  }

  console.error("Discovery management failed:", error);

  return fail("Unable to complete this operation.", 500);
}

async function readBody(request: Request) {
  const body = await request.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DiscoveryValidationError("Invalid request body.");
  }

  return body as Record<string, unknown>;
}

async function validateSport(value: unknown) {
  const sportId = requiredId(value, "Sport");

  const sport = await db.orm.public.Sport
    .where({ id: sportId })
    .first();

  if (!sport || !sport.isActive) {
    throw new DiscoveryValidationError(
      "Select an available sport."
    );
  }

  return sportId;
}

function profileFields(body: Record<string, unknown>) {
  return {
    name: requiredText(body.name, "Name", 150),
    shortName: optionalText(body.shortName, "Short name", 80),
    country: optionalText(body.country, "Country", 100),
    description: optionalText(body.description, "Competition description", 20000),
    competitionType: optionalText(body.competitionType, "Competition type", 80),
    foundedYear: optionalInteger(body.foundedYear, "Founded year", 1700, new Date().getFullYear()),
    logoUrl: optionalHttpsUrl(body.logoUrl, "Logo URL"),
    coverUrl: optionalHttpsUrl(body.coverUrl, "Cover image URL"),
    websiteUrl: optionalHttpsUrl(body.websiteUrl, "Official website"),
    seoTitle: optionalText(body.seoTitle, "SEO title", 70),
    seoDescription: optionalText(body.seoDescription, "SEO description", 180),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const params = new URL(request.url).searchParams;

    if (params.get("paginated") === "1") {
      try {
        const result = await loadAdminDirectory(
          params,
          "competitions"
        );

        return NextResponse.json(result, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      } catch (error) {
        if (error instanceof DirectoryQueryError) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }

        throw error;
      }
    }


    const [records, sports] = await Promise.all([
      db.orm.public.Competition.all(),
      db.orm.public.Sport.all(),
    ]);

    return NextResponse.json(
      {
        success: true,
        competitions: records
          .map(record => ({
            ...record,
            sportName:
              sports.find(sport => sport.id === record.sportId)?.name
              ?? "Sport",
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        sports: sports.filter(sport => sport.isActive),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const body = await readBody(request);
    const fields = profileFields(body);
    const sportId = await validateSport(body.sportId);

    const existing = await db.orm.public.Competition
      .where({ name: fields.name, sportId })
      .first();

    if (existing) {
      return fail("This competition already exists.", 409);
    }

    const baseSlug = createDiscoverySlug(fields.name);
    let slug = baseSlug;
    let suffix = 2;

    while (
      await db.orm.public.Competition.where({ slug }).first()
    ) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const record = await db.orm.public.Competition.create({
      ...fields,
      sportId,
      slug,
      dataSource: "MANUAL",
      publicationStatus: "DRAFT",
      isActive: true,
    });

    return NextResponse.json(
      { success: true, competition: record },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const body = await readBody(request);
    const id = requiredId(body.id, "Profile ID");

    const existing = await db.orm.public.Competition
      .where({ id })
      .first();

    if (!existing) {
      return fail("Profile not found.", 404);
    }

    if (
      "sportId" in body &&
      requiredId(body.sportId, "Sport") !== existing.sportId
    ) {
      return fail("The sport of an existing profile cannot be changed.");
    }

    const nextStatus =
      "publicationStatus" in body
        ? publicationStatus(body.publicationStatus)
        : existing.publicationStatus;

    if (
      "publicationStatus" in body &&
      !hasPermission(auth.user.staffRole, "discovery:publish")
    ) {
      return fail("Publication permission is required.", 403);
    }

    if (
      existing.publicationStatus === "PUBLISHED" &&
      !hasPermission(auth.user.staffRole, "discovery:publish")
    ) {
      return fail("Publication permission is required.", 403);
    }

    const fields = {
      ...("name" in body
        ? { name: requiredText(body.name, "Name", 150) }
        : {}),
      ...("shortName" in body ? { shortName: optionalText(body.shortName, "Short name", 80) } : {}),
      ...("country" in body ? { country: optionalText(body.country, "Country", 100) } : {}),
      ...("description" in body ? { description: optionalText(body.description, "Competition description", 20000) } : {}),
      ...("competitionType" in body ? { competitionType: optionalText(body.competitionType, "Competition type", 80) } : {}),
      ...("foundedYear" in body ? { foundedYear: optionalInteger(body.foundedYear, "Founded year", 1700, new Date().getFullYear()) } : {}),
      ...("logoUrl" in body ? { logoUrl: optionalHttpsUrl(body.logoUrl, "Logo URL") } : {}),
      ...("coverUrl" in body ? { coverUrl: optionalHttpsUrl(body.coverUrl, "Cover image URL") } : {}),
      ...("websiteUrl" in body ? { websiteUrl: optionalHttpsUrl(body.websiteUrl, "Official website") } : {}),
      ...("seoTitle" in body ? { seoTitle: optionalText(body.seoTitle, "SEO title", 70) } : {}),
      ...("seoDescription" in body ? { seoDescription: optionalText(body.seoDescription, "SEO description", 180) } : {}),
    };

    const merged = { ...existing, ...fields };

    if (merged.name !== existing.name) {
      const duplicate = await db.orm.public.Competition
        .where({
          name: merged.name,
          sportId: existing.sportId,
        })
        .first();

      if (duplicate && duplicate.id !== id) {
        return fail("This competition already exists.", 409);
      }
    }

    if (nextStatus === "PUBLISHED") {
      await validateSport(existing.sportId);

      if (!existing.isActive) {
        return fail("An inactive profile cannot be published.");
      }

      requiredText(merged.name, "Name", 150);

      // International and provider-imported competitions
      // may not have a country or supplied description.
      if (
        existing.dataSource !== "PROVIDER" &&
        (
          !merged.country?.trim() ||
          !merged.description ||
          merged.description.trim().length < 50
        )
      ) {
        return fail(
          "Publishing requires a country and a description of at least 50 characters."
        );
      }
    }

    await db.orm.public.Competition
      .where({ id })
      .update({
        ...fields,
        publicationStatus: nextStatus,
        publishedAt:
          nextStatus === "PUBLISHED"
            ? existing.publishedAt ?? new Date().toISOString()
            : null,
      });

    const record = await db.orm.public.Competition
      .where({ id })
      .first();

    return NextResponse.json({
      success: true,
      competition: record,
    });
  } catch (error) {
    return handleError(error);
  }
}
