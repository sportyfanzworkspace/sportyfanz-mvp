import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  isPublicDirectoryRecord,
} from "@/lib/discovery/public-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
};

function fail(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers }
  );
}

function success(
  type: string,
  profile: object
) {
  return NextResponse.json(
    { success: true, type, profile },
    { headers }
  );
}

function playerName(player: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return (
    player.displayName?.trim() ||
    `${player.firstName} ${player.lastName}`.trim()
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;

    const type = params.get("type");
    const slug = params.get("slug")?.trim();

    if (
      !type ||
      !["club", "player", "competition"].includes(type)
    ) {
      return fail("Invalid profile type.", 400);
    }

    if (!slug || slug.length > 200) {
      return fail("A valid profile slug is required.", 400);
    }

    const sports = (
      await db.orm.public.Sport.all()
    ).filter(sport => sport.isActive);

    const activeSportIds = new Set(
      sports.map(sport => sport.id)
    );

    const sportName = (id: number | null) =>
      sports.find(sport => sport.id === id)?.name ?? null;

    const sportSlug = (id: number | null) =>
      sports.find(sport => sport.id === id)?.slug ?? null;

    if (type === "club") {
      const club = await db.orm.public.Team
        .where({ slug })
        .first();

      if (
        !club ||
        !isPublicDirectoryRecord(
          club,
          activeSportIds
        )
      ) {
        return fail("Profile not found.", 404);
      }

      const [memberships, competitionEntries] =
        await Promise.all([
          db.orm.public.PlayerTeam
            .where({ teamId: club.id })
            .all(),
          db.orm.public.CompetitionTeam
            .where({ teamId: club.id })
            .all(),
        ]);

      const playerIds = [...new Set(
        memberships
          .filter(item => item.leftAt === null)
          .map(item => item.playerId)
      )];

      const seasonIds = [...new Set(
        competitionEntries.map(item => item.seasonId)
      )];

      const [players, affiliatedSeasons] =
        await Promise.all([
          playerIds.length
            ? db.orm.public.Player
                .where(item => item.id.in(playerIds))
                .all()
            : Promise.resolve([]),
          seasonIds.length
            ? db.orm.public.CompetitionSeason
                .where(item => item.id.in(seasonIds))
                .all()
            : Promise.resolve([]),
        ]);

      const squad = [];

      for (const player of players) {

        if (
          !player ||
          !isPublicDirectoryRecord(
            player,
            activeSportIds,
            true
          ) ||
          (
            player.sportId !== null &&
            player.sportId !== club.sportId
          )
        ) {
          continue;
        }

        squad.push({
          id: player.id,
          name: playerName(player),
          slug: player.slug,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          nationality: player.nationality,
          avatarUrl: player.avatarUrl,
        });
      }

      squad.sort(
        (a, b) => a.name.localeCompare(b.name)
      );

      const competitionIds = [...new Set(
        affiliatedSeasons.map(item => item.competitionId)
      )];

      const affiliatedCompetitions =
        competitionIds.length
          ? await db.orm.public.Competition
              .where(item => item.id.in(competitionIds))
              .all()
          : [];

      const competitions = affiliatedCompetitions
        .filter(item =>
          item.sportId === club.sportId &&
          isPublicDirectoryRecord(
            item,
            activeSportIds
          )
        )
        .map(item => ({
          id: item.id,
          name: item.name,
          shortName: item.shortName,
          slug: item.slug,
          logoUrl: item.logoUrl,
          country: item.country,
          competitionType: item.competitionType,
          seasons: affiliatedSeasons
            .filter(season =>
              season.competitionId === item.id
            )
            .map(season => ({
              id: season.id,
              name: season.name,
              startsAt: season.startsAt,
              endsAt: season.endsAt,
              isCurrent: season.isCurrent,
            }))
            .sort((a, b) =>
              Number(b.isCurrent) - Number(a.isCurrent) ||
              (Date.parse(b.startsAt ?? "") || 0) -
              (Date.parse(a.startsAt ?? "") || 0) ||
              b.id - a.id
            ),
        }))
        .sort((a, b) =>
          Number(b.seasons.some(season => season.isCurrent)) -
          Number(a.seasons.some(season => season.isCurrent)) ||
          a.name.localeCompare(b.name)
        );

      const publicSeasonIds = new Set(
        competitions.flatMap(
          competition =>
            competition.seasons.map(season => season.id)
        )
      );

      const clubStandingRows = publicSeasonIds.size
        ? await db.orm.public.CompetitionStanding
            .where({ teamId: club.id })
            .all()
        : [];

      const statistics = clubStandingRows
        .filter(row => publicSeasonIds.has(row.seasonId))
        .map(row => ({
          seasonId: row.seasonId,
          groupName: row.groupName,
          rank: row.rank,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          scored: row.scored,
          conceded: row.conceded,
          difference: row.difference,
          points: row.points,
          form: row.form,
          observedAt: row.providerObservedAt,
        }))
        .sort((a, b) =>
          b.seasonId - a.seasonId ||
          a.groupName.localeCompare(b.groupName) ||
          a.rank - b.rank
        );

      return success("club", {
        id: club.id,
        name: club.name,
        shortName: club.shortName,
        slug: club.slug,
        sportId: club.sportId,
        sportName: sportName(club.sportId),
        country: club.country,
        city: club.city,
        logoUrl: club.logoUrl,
        coverUrl: club.coverUrl,
        overview: club.overview,
        nickname: club.nickname,
        foundedYear: club.foundedYear,
        stadiumName: club.stadiumName,
        stadiumCapacity: club.stadiumCapacity,
        websiteUrl: club.websiteUrl,
        squad,
        competitions,
        statistics,
        sportSlug: sportSlug(club.sportId),
      });
    }

    if (type === "player") {
      const player = await db.orm.public.Player
        .where({ slug })
        .first();

      if (
        !player ||
        !isPublicDirectoryRecord(
          player,
          activeSportIds,
          true
        )
      ) {
        return fail("Profile not found.", 404);
      }

      const [memberships, careers] =
        await Promise.all([
          db.orm.public.PlayerTeam
            .where({ playerId: player.id })
            .all(),
          db.orm.public.PlayerCareer
            .where({ playerId: player.id })
            .all(),
        ]);

      const teamIds = [...new Set([
        ...memberships.map(item => item.teamId),
        ...careers.map(item => item.teamId),
      ])];

      const relatedClubs = teamIds.length
        ? await db.orm.public.Team
            .where(item => item.id.in(teamIds))
            .all()
        : [];

      const clubs = relatedClubs.filter(club =>
        isPublicDirectoryRecord(
          club,
          activeSportIds
        ) &&
        (
          player.sportId === null ||
          player.sportId === club.sportId
        )
      );

      const clubsById = new Map(
        clubs.map(club => [club.id, club])
      );

      const currentClubs = memberships
        .filter(item =>
          item.leftAt === null &&
          clubsById.has(item.teamId)
        )
        .map(item => {
          const club = clubsById.get(item.teamId)!;

          return {
            id: club.id,
            name: club.name,
            slug: club.slug,
            logoUrl: club.logoUrl,
            sportName: sportName(club.sportId),
          };
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );

      const careerHistory = careers
        .filter(item =>
          clubsById.has(item.teamId)
        )
        .map(item => {
          const club = clubsById.get(item.teamId)!;

          return {
            id: item.id,
            clubId: club.id,
            clubName: club.name,
            clubSlug: club.slug,
            clubLogoUrl: club.logoUrl,
            joinedAt: item.joinedAt,
            leftAt: item.leftAt,
            position: item.position,
            jerseyNumber: item.jerseyNumber,
            transferType: item.transferType,
          };
        })
        .sort((a, b) =>
          (Date.parse(b.joinedAt ?? "") || 0) -
          (Date.parse(a.joinedAt ?? "") || 0)
        );

      const statisticRows =
        await db.orm.public.PlayerStatistics
          .where({ playerId: player.id })
          .all();

      const statisticSeasonIds = [...new Set(
        statisticRows.map(item => item.seasonId)
      )];

      const statisticTeamIds = [...new Set(
        statisticRows.map(item => item.teamId)
      )];

      const [statisticSeasons, statisticTeams] =
        await Promise.all([
          statisticSeasonIds.length
            ? db.orm.public.CompetitionSeason
                .where(item =>
                  item.id.in(statisticSeasonIds)
                )
                .all()
            : Promise.resolve([]),
          statisticTeamIds.length
            ? db.orm.public.Team
                .where(item =>
                  item.id.in(statisticTeamIds)
                )
                .all()
            : Promise.resolve([]),
        ]);

      const statisticCompetitionIds = [...new Set(
        statisticSeasons.map(
          item => item.competitionId
        )
      )];

      const statisticCompetitions =
        statisticCompetitionIds.length
          ? await db.orm.public.Competition
              .where(item =>
                item.id.in(statisticCompetitionIds)
              )
              .all()
          : [];

      const statisticTeamsById = new Map(
        statisticTeams
          .filter(team =>
            team.sportId === player.sportId &&
            isPublicDirectoryRecord(
              team,
              activeSportIds
            )
          )
          .map(team => [team.id, team])
      );

      const statisticCompetitionsById = new Map(
        statisticCompetitions
          .filter(competition =>
            competition.sportId === player.sportId &&
            isPublicDirectoryRecord(
              competition,
              activeSportIds
            )
          )
          .map(item => [item.id, item])
      );

      const statisticSeasonsById = new Map<
        number,
        {
          id: number;
          competitionId: number;
          name: string;
          isCurrent: boolean;
        }
      >();

      for (const item of statisticSeasons) {
        statisticSeasonsById.set(item.id, {
          id: item.id,
          competitionId: item.competitionId,
          name: item.name,
          isCurrent: item.isCurrent,
        });
      }

      const statistics = statisticRows.flatMap(row => {
        const team =
          statisticTeamsById.get(row.teamId);

        const season =
          statisticSeasonsById.get(row.seasonId);

        const competition = season
          ? statisticCompetitionsById.get(
              season.competitionId
            )
          : undefined;

        if (!team || !season || !competition) {
          return [];
        }

        const metricValue = Number(row.metricValue);

        if (
          row.metricValue == null ||
          !Number.isFinite(metricValue)
        ) {
          return [];
        }

        return [{
          teamId: team.id,
          teamName: team.name,
          teamSlug: team.slug,
          teamLogoUrl: team.logoUrl,
          competitionId: competition.id,
          competitionName: competition.name,
          competitionSlug: competition.slug,
          seasonId: season.id,
          seasonName: season.name,
          isCurrent: season.isCurrent,
          metricKey: row.metricKey,
          metricLabel: row.metricLabel,
          metricValue,
          observedAt: row.providerObservedAt,
        }];
      }).sort((a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        b.seasonId - a.seasonId ||
        a.competitionName.localeCompare(
          b.competitionName
        ) ||
        a.teamName.localeCompare(b.teamName) ||
        a.metricLabel.localeCompare(b.metricLabel)
      );

      return success("player", {
        id: player.id,
        name: playerName(player),
        firstName: player.firstName,
        lastName: player.lastName,
        slug: player.slug,
        sportId: player.sportId,
        sportName: sportName(player.sportId),
        position: player.position,
        nationality: player.nationality,
        jerseyNumber: player.jerseyNumber,
        avatarUrl: player.avatarUrl,
        biography: player.biography,
        dateOfBirth: player.dateOfBirth,
        heightCm: player.heightCm,
        weightKg: player.weightKg,
        preferredFoot: player.preferredFoot,
        achievements: player.achievements,
        currentClubs,
        careerHistory,
        statistics,
        sportSlug: sportSlug(player.sportId),
      });
    }

    const competition =
      await db.orm.public.Competition
        .where({ slug })
        .first();

    if (
      !competition ||
      !isPublicDirectoryRecord(
        competition,
        activeSportIds
      )
    ) {
      return fail("Profile not found.", 404);
    }

    const seasons =
      await db.orm.public.CompetitionSeason
        .where({ competitionId: competition.id })
        .all();

    const seasonIds = seasons.map(item => item.id);

    const entries = seasonIds.length
      ? await db.orm.public.CompetitionTeam
          .where(item => item.seasonId.in(seasonIds))
          .all()
      : [];

    const teamIds = [...new Set(
      entries.map(item => item.teamId)
    )];

    const relatedClubs = teamIds.length
      ? await db.orm.public.Team
          .where(item => item.id.in(teamIds))
          .all()
      : [];

    const clubsById = new Map(
      relatedClubs
        .filter(club =>
          club.sportId === competition.sportId &&
          isPublicDirectoryRecord(
            club,
            activeSportIds
          )
        )
        .map(club => [club.id, club])
    );

    const entriesBySeason = new Map<
      number,
      typeof entries
    >();

    for (const entry of entries) {
      const existing = entriesBySeason.get(entry.seasonId);

      if (existing) {
        existing.push(entry);
      } else {
        entriesBySeason.set(entry.seasonId, [entry]);
      }
    }

    const standingRows = seasonIds.length
      ? await db.orm.public.CompetitionStanding
          .where(item =>
            item.seasonId.in(seasonIds)
          )
          .all()
      : [];

    const standingsBySeason = new Map<
      number,
      typeof standingRows
    >();

    for (const row of standingRows) {
      const existing =
        standingsBySeason.get(row.seasonId);

      if (existing) {
        existing.push(row);
      } else {
        standingsBySeason.set(row.seasonId, [row]);
      }
    }

    const publicSeasons = [];

    for (const season of seasons) {
      const seasonEntries =
        entriesBySeason.get(season.id) ?? [];

      const clubs = [];

      for (const entry of seasonEntries) {
        const club = clubsById.get(entry.teamId);

        if (
          !club ||
          club.sportId !== competition.sportId ||
          !isPublicDirectoryRecord(
            club,
            activeSportIds
          )
        ) {
          continue;
        }

        clubs.push({
          id: club.id,
          name: club.name,
          slug: club.slug,
          logoUrl: club.logoUrl,
          country: club.country,
        });
      }

      clubs.sort(
        (a, b) => a.name.localeCompare(b.name)
      );

      const participatingClubIds = new Set(
        clubs.map(club => club.id)
      );

      const standings = (
        standingsBySeason.get(season.id) ?? []
      ).flatMap(row => {
        const club = clubsById.get(row.teamId);

        if (
          !club ||
          !participatingClubIds.has(row.teamId)
        ) {
          return [];
        }

        return [{
          teamId: club.id,
          teamName: club.name,
          teamSlug: club.slug,
          teamLogoUrl: club.logoUrl,
          groupName: row.groupName,
          rank: row.rank,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          scored: row.scored,
          conceded: row.conceded,
          difference: row.difference,
          points: row.points,
          form: row.form,
          observedAt: row.providerObservedAt,
        }];
      }).sort((a, b) =>
        a.groupName.localeCompare(b.groupName) ||
        a.rank - b.rank ||
        a.teamName.localeCompare(b.teamName)
      );

      publicSeasons.push({
        id: season.id,
        name: season.name,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
        isCurrent: season.isCurrent,
        clubs,
        standings,
      });
    }

    publicSeasons.sort((a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      (Date.parse(b.startsAt ?? "") || 0) -
      (Date.parse(a.startsAt ?? "") || 0) ||
      b.id - a.id
    );

    return success("competition", {
      id: competition.id,
      name: competition.name,
      shortName: competition.shortName,
      slug: competition.slug,
      sportId: competition.sportId,
      sportName: sportName(competition.sportId),
      country: competition.country,
      description: competition.description,
      competitionType: competition.competitionType,
      foundedYear: competition.foundedYear,
      logoUrl: competition.logoUrl,
      coverUrl: competition.coverUrl,
      websiteUrl: competition.websiteUrl,
      seasons: publicSeasons,
      sportSlug: sportSlug(competition.sportId),
    });
  } catch (error) {
    console.error(
      "GET /api/discover/profile error:",
      error
    );

    return fail("Unable to load profile.", 500);
  }
}
