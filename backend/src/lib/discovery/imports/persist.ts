import {
  withImportTransaction,
  type DiscoveryImportTransaction,
} from "./transaction";

import {
  createDiscoverySlug,
  normalizeSearch,
} from "../validation";

import {
  getApiSportsProvider,
} from "../providers/config";

import type {
  ImportedCompetition,
  ImportedClub,
} from "./normalize";

export type ImportOutcome = {
  status:
    | "CREATED"
    | "UPDATED"
    | "EXISTING"
    | "CONFLICT"
    | "SKIPPED";
  id: number | null;
  reason: string;
};

function outcome(
  status: ImportOutcome["status"],
  id: number | null,
  reason: string
): ImportOutcome {
  return { status, id, reason };
}

function validProviderIdentity(
  sportSlug: string,
  providerName: string,
  providerId: number
): boolean {
  const config = getApiSportsProvider(sportSlug);

  return (
    config !== null &&
    config.sportSlug === sportSlug &&
    config.providerName === providerName &&
    Number.isSafeInteger(providerId) &&
    providerId > 0 &&
    providerId <= 2147483647
  );
}

export function hasNameConflict(
  incomingName: string,
  existingNames: readonly string[]
): boolean {
  const normalized = normalizeSearch(incomingName);

  return existingNames.some(
    name => normalizeSearch(name) === normalized
  );
}

export async function importCompetition(
  input: ImportedCompetition,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  if (
    !validProviderIdentity(
      input.sportSlug,
      input.providerName,
      input.providerLeagueId
    )
  ) {
    return outcome(
      "SKIPPED",
      null,
      "Invalid provider identity."
    );
  }

  return withImportTransaction(transaction, async tx => {
    const sport = await tx.orm.public.Sport
      .where({ slug: input.sportSlug })
      .first();

    if (!sport || !sport.isActive) {
      return outcome(
        "SKIPPED",
        null,
        "Sport is unavailable or inactive."
      );
    }

    const existing = await tx.orm.public.Competition
      .where({
        providerName: input.providerName,
        providerLeagueId: String(input.providerLeagueId),
      })
      .first();

    if (existing) {
      if (existing.sportId !== sport.id) {
        return outcome(
          "CONFLICT",
          existing.id,
          "Provider identity belongs to another sport."
        );
      }

      if (
        existing.dataSource !== "PROVIDER" ||
        !existing.isActive ||
        existing.publicationStatus === "ARCHIVED"
      ) {
        return outcome(
          "EXISTING",
          existing.id,
          "Protected competition preserved."
        );
      }

      if (!input.seasons.length) {
        return outcome(
          "EXISTING",
          existing.id,
          "Existing competition preserved."
        );
      }

      const locked = await tx.orm.public.Competition
        .where({
          id: existing.id,
          updatedAt: existing.updatedAt,
          dataSource: "PROVIDER",
          isActive: true,
        })
        .update({
          id: existing.id,
          updatedAt: existing.updatedAt,
        });

      if (!locked) {
        throw new Error(
          "Competition changed during season synchronization."
        );
      }

      const storedSeasons =
        await tx.orm.public.CompetitionSeason
          .where({ competitionId: existing.id })
          .all();

      const incomingKeys = new Set(
        input.seasons.map(
          season => season.providerSeason
        )
      );

      const incomingCurrent = input.seasons.find(
        season => season.isCurrent
      );

      if (
        incomingKeys.size !== input.seasons.length ||
        input.seasons.filter(
          season => season.isCurrent
        ).length > 1
      ) {
        return outcome(
          "CONFLICT",
          existing.id,
          "Invalid incoming season collection."
        );
      }

      // Validate all identities before changing records.
      for (const season of input.seasons) {
        const matches = storedSeasons.filter(
          item =>
            item.providerSeason ===
              season.providerSeason
        );

        if (
          matches.length > 1 ||
          storedSeasons.some(
            item =>
              item.name === season.name &&
              item.providerSeason !==
                season.providerSeason
          )
        ) {
          return outcome(
            "CONFLICT",
            existing.id,
            "Season identity requires reconciliation."
          );
        }
      }

      if (
        incomingCurrent &&
        storedSeasons.some(
          item =>
            item.isCurrent &&
            !item.providerSeason
        )
      ) {
        return outcome(
          "CONFLICT",
          existing.id,
          "Manually maintained current season preserved."
        );
      }

      let changed = false;

      for (const season of input.seasons) {
        const stored = storedSeasons.find(
          item =>
            item.providerSeason ===
              season.providerSeason
        );

        if (!stored) {
          await tx.orm.public.CompetitionSeason.create({
            competitionId: existing.id,
            name: season.name,
            providerSeason: season.providerSeason,
            startsAt: season.startsAt,
            endsAt: season.endsAt,
            isCurrent: season.isCurrent,
          });

          changed = true;
          continue;
        }

        const isCurrent = incomingCurrent
          ? season.isCurrent
          : stored.isCurrent;

        if (stored.isCurrent !== isCurrent) {
          await tx.orm.public.CompetitionSeason
            .where({ id: stored.id })
            .update({ isCurrent });

          changed = true;
        }
      }

      if (incomingCurrent) {
        for (const stored of storedSeasons) {
          if (
            stored.providerSeason &&
            stored.isCurrent &&
            !incomingKeys.has(stored.providerSeason)
          ) {
            await tx.orm.public.CompetitionSeason
              .where({ id: stored.id })
              .update({ isCurrent: false });

            changed = true;
          }
        }
      }

      if (changed) {
        await tx.orm.public.Competition
          .where({ id: existing.id })
          .update({
            lastSyncedAt: new Date().toISOString(),
          });
      }

      return outcome(
        changed ? "UPDATED" : "EXISTING",
        existing.id,
        changed
          ? "Competition seasons synchronized."
          : "Existing competition preserved."
      );
    }

    const sameSport = await tx.orm.public.Competition
      .where({ sportId: sport.id })
      .all();

    if (
      hasNameConflict(
        input.name,
        sameSport.map(item => item.name)
      )
    ) {
      return outcome(
        "CONFLICT",
        null,
        "Potential existing competition requires identity verification."
      );
    }

    const baseSlug = createDiscoverySlug(
      `${input.sportSlug}-${input.name}`
    );

    let slug = baseSlug;
    let suffix = 2;

    while (
      await tx.orm.public.Competition
        .where({ slug })
        .first()
    ) {
      if (suffix > 1000) {
        throw new Error(
          "Unable to allocate competition slug."
        );
      }

      slug = `${baseSlug}-${suffix++}`;
    }

    const competition =
      await tx.orm.public.Competition.create({
        sportId: sport.id,
        name: input.name,
        slug,
        country: input.country,
        competitionType: input.competitionType,
        logoUrl: input.logoUrl,
        providerName: input.providerName,
        providerLeagueId: String(input.providerLeagueId),
        dataSource: "PROVIDER",
        publicationStatus: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        isActive: true,
        lastSyncedAt: new Date().toISOString(),
      });

    for (const season of input.seasons) {
      await tx.orm.public.CompetitionSeason.create({
        competitionId: competition.id,
        name: season.name,
        providerSeason: season.providerSeason,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
        isCurrent: season.isCurrent,
      });
    }

    return outcome(
      "CREATED",
      competition.id,
      "Competition and available seasons imported."
    );
  });
}

export async function importClub(
  input: ImportedClub,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  if (
    !validProviderIdentity(
      input.sportSlug,
      input.providerName,
      input.providerTeamId
    )
  ) {
    return outcome(
      "SKIPPED",
      null,
      "Invalid provider identity."
    );
  }

  return withImportTransaction(transaction, async tx => {
    const sport = await tx.orm.public.Sport
      .where({ slug: input.sportSlug })
      .first();

    if (!sport || !sport.isActive) {
      return outcome(
        "SKIPPED",
        null,
        "Sport is unavailable or inactive."
      );
    }

    const existing = await tx.orm.public.Team
      .where({
        providerName: input.providerName,
        providerTeamId: String(input.providerTeamId),
      })
      .first();

    if (existing) {
      if (existing.sportId !== sport.id) {
        return outcome(
          "CONFLICT",
          existing.id,
          "Provider identity belongs to another sport."
        );
      }

      return outcome(
        "EXISTING",
        existing.id,
        "Existing club preserved."
      );
    }

    const sameSport = await tx.orm.public.Team
      .where({ sportId: sport.id })
      .all();

    if (
      hasNameConflict(
        input.name,
        sameSport.map(item => item.name)
      )
    ) {
      return outcome(
        "CONFLICT",
        null,
        "Potential existing club requires identity verification."
      );
    }

    const baseSlug = createDiscoverySlug(
      `${input.sportSlug}-${input.name}`
    );

    let slug = baseSlug;
    let suffix = 2;

    while (
      await tx.orm.public.Team
        .where({ slug })
        .first()
    ) {
      if (suffix > 1000) {
        throw new Error(
          "Unable to allocate club slug."
        );
      }

      slug = `${baseSlug}-${suffix++}`;
    }

    const club = await tx.orm.public.Team.create({
      sportId: sport.id,
      name: input.name,
      slug,
      shortName: input.shortName,
      country: input.country,
      city: input.city,
      foundedYear: input.foundedYear,
      logoUrl: input.logoUrl,
      stadiumName: input.stadiumName,
      stadiumCapacity: input.stadiumCapacity,
      providerName: input.providerName,
      providerTeamId: String(input.providerTeamId),
      dataSource: "PROVIDER",
      publicationStatus: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    });

    return outcome(
      "CREATED",
      club.id,
      "Club imported successfully."
    );
  });
}

/**
 * Reconcile an explicitly selected existing club
 * with a verified provider identity.
 *
 * This operation must only receive provider records
 * obtained through a trusted, validated import process.
 * Ordinary directory imports must not automatically
 * convert manually maintained clubs.
 */
export async function reconcileExistingClub(
  clubId: number,
  input: ImportedClub,
  transaction?: DiscoveryImportTransaction,
  approvedAlias?: {
    localName: string;
    providerClubName: string;
    providerName: string;
    providerTeamId: number;
  }
): Promise<ImportOutcome> {
  if (
    !Number.isSafeInteger(clubId) ||
    clubId < 1 ||
    !validProviderIdentity(
      input.sportSlug,
      input.providerName,
      input.providerTeamId
    )
  ) {
    return outcome(
      "SKIPPED",
      null,
      "Invalid club or provider identity."
    );
  }

  return withImportTransaction(transaction, async tx => {
    const sport = await tx.orm.public.Sport
      .where({ slug: input.sportSlug })
      .first();

    if (!sport?.isActive) {
      return outcome(
        "SKIPPED",
        null,
        "Sport unavailable or inactive."
      );
    }

    const current = await tx.orm.public.Team
      .where({ id: clubId })
      .first();

    if (!current) {
      return outcome(
        "SKIPPED",
        null,
        "Existing club not found."
      );
    }

    // Lock the selected record using the established
    // club profile transaction pattern.
    const club = await tx.orm.public.Team
      .where({ id: clubId })
      .update({
        id: clubId,
        updatedAt: current.updatedAt,
      });

    if (
      !club ||
      !club.isActive ||
      club.publicationStatus === "ARCHIVED"
    ) {
      return outcome(
        "SKIPPED",
        clubId,
        "Club is inactive or archived."
      );
    }

    if (club.sportId !== sport.id) {
      return outcome(
        "CONFLICT",
        clubId,
        "Club belongs to another sport."
      );
    }

    const exactNameMatch =
      normalizeSearch(club.name) ===
      normalizeSearch(input.name);

    const approvedAliasMatch =
      approvedAlias !== undefined &&
      approvedAlias.localName === club.name &&
      approvedAlias.providerClubName === input.name &&
      approvedAlias.providerName === input.providerName &&
      approvedAlias.providerTeamId === input.providerTeamId;

    if (!exactNameMatch && !approvedAliasMatch) {
      return outcome(
        "CONFLICT",
        clubId,
        "Club name requires explicit identity review."
      );
    }

    if (
      !club.country?.trim() ||
      !input.country?.trim() ||
      normalizeSearch(club.country) !==
        normalizeSearch(input.country)
    ) {
      return outcome(
        "CONFLICT",
        clubId,
        "Club country could not be verified."
      );
    }

    if (
      club.city?.trim() &&
      input.city?.trim() &&
      normalizeSearch(club.city) !==
        normalizeSearch(input.city)
    ) {
      return outcome(
        "CONFLICT",
        clubId,
        "Club city requires identity review."
      );
    }

    const providerTeamId =
      String(input.providerTeamId);

    const identityOwner =
      await tx.orm.public.Team
        .where({
          providerName: input.providerName,
          providerTeamId,
        })
        .first();

    if (
      identityOwner &&
      identityOwner.id !== clubId
    ) {
      return outcome(
        "CONFLICT",
        clubId,
        "Provider identity belongs to another club."
      );
    }

    const alreadyLinked =
      club.providerName === input.providerName &&
      club.providerTeamId === providerTeamId &&
      club.dataSource === "PROVIDER";

    if (
      !alreadyLinked &&
      (
        club.providerName != null ||
        club.providerTeamId != null ||
        club.dataSource !== "MANUAL"
      )
    ) {
      return outcome(
        "CONFLICT",
        clubId,
        "Existing provider classification requires review."
      );
    }

    const sameSport = await tx.orm.public.Team
      .where({ sportId: sport.id })
      .all();

    if (
      hasNameConflict(
        input.name,
        sameSport
          .filter(item => item.id !== clubId)
          .map(item => item.name)
      )
    ) {
      return outcome(
        "CONFLICT",
        clubId,
        "Another club has a matching name."
      );
    }

    function missingText(
      existing: string | null,
      incoming: string | null
    ): string | null {
      return existing?.trim()
        ? existing
        : incoming?.trim()
          ? incoming
          : existing;
    }

    const fields = {
      shortName: missingText(
        club.shortName,
        input.shortName
      ),
      city: missingText(
        club.city,
        input.city
      ),
      logoUrl: missingText(
        club.logoUrl,
        input.logoUrl
      ),
      foundedYear:
        club.foundedYear ?? input.foundedYear,
      stadiumName: missingText(
        club.stadiumName,
        input.stadiumName
      ),
      stadiumCapacity:
        club.stadiumCapacity ?? input.stadiumCapacity,
    };

    const changed =
      fields.shortName !== club.shortName ||
      fields.city !== club.city ||
      fields.logoUrl !== club.logoUrl ||
      fields.foundedYear !== club.foundedYear ||
      fields.stadiumName !== club.stadiumName ||
      fields.stadiumCapacity !== club.stadiumCapacity;

    if (alreadyLinked && !changed) {
      return outcome(
        "EXISTING",
        clubId,
        "Verified club already reconciled."
      );
    }

    await tx.orm.public.Team
      .where({ id: clubId })
      .update({
        ...fields,
        providerName: input.providerName,
        providerTeamId,
        dataSource: "PROVIDER",
        lastSyncedAt: new Date().toISOString(),
      });

    return outcome(
      "UPDATED",
      clubId,
      "Existing club reconciled and enriched."
    );
  });
}

export async function linkClubToSeason(
  clubId: number,
  seasonId: number,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  if (
    !Number.isSafeInteger(clubId) ||
    clubId < 1 ||
    !Number.isSafeInteger(seasonId) ||
    seasonId < 1
  ) {
    return outcome(
      "SKIPPED",
      null,
      "Invalid club or season identifier."
    );
  }

  return withImportTransaction(transaction, async tx => {
    const club = await tx.orm.public.Team
      .where({ id: clubId })
      .first();

    const season =
      await tx.orm.public.CompetitionSeason
        .where({ id: seasonId })
        .first();

    if (!club || !season || !club.isActive) {
      return outcome(
        "SKIPPED",
        null,
        "Club or competition season unavailable."
      );
    }

    const competition =
      await tx.orm.public.Competition
        .where({ id: season.competitionId })
        .first();

    if (
      !competition ||
      !competition.isActive ||
      competition.sportId !== club.sportId
    ) {
      return outcome(
        "CONFLICT",
        null,
        "Club and competition sports do not match."
      );
    }

    const sport = await tx.orm.public.Sport
      .where({ id: club.sportId })
      .first();

    if (
      !sport ||
      !sport.isActive ||
      club.publicationStatus === "ARCHIVED" ||
      competition.publicationStatus === "ARCHIVED"
    ) {
      return outcome(
        "SKIPPED",
        null,
        "Archived or inactive directory record."
      );
    }

    if (
      club.dataSource !== "PROVIDER" ||
      competition.dataSource !== "PROVIDER" ||
      !club.providerName ||
      club.providerName !== competition.providerName
    ) {
      return outcome(
        "CONFLICT",
        null,
        "Provider relationship requires verification."
      );
    }

    const existing =
      await tx.orm.public.CompetitionTeam
        .where({
          seasonId,
          teamId: clubId,
        })
        .first();

    if (existing) {
      return outcome(
        "EXISTING",
        clubId,
        "Club is already linked to this season."
      );
    }

    await tx.orm.public.CompetitionTeam.create({
      seasonId,
      teamId: clubId,
    });

    return outcome(
      "CREATED",
      clubId,
      "Club linked to competition season."
    );
  });
}
