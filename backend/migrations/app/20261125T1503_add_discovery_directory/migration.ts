#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c5cd03e6bc68cad1ddf2ad42e737c2bb138e771979a4acaa852dc0b736cea5fe/contract';
import endContract from '../../snapshots/c5cd03e6bc68cad1ddf2ad42e737c2bb138e771979a4acaa852dc0b736cea5fe/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/da6226bdb051a353bbc2d68c8f89fe148e4c55e26157c5d4814897630009d1ae/contract';
import startContract from '../../snapshots/da6226bdb051a353bbc2d68c8f89fe148e4c55e26157c5d4814897630009d1ae/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'competition_seasons',
        columns: [
          col('competitionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isCurrent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerSeason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'competition_standings',
        columns: [
          col('conceded', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('dataSource', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('difference', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('drawn', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('form', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('groupName', 'text', {
            notNull: true,
            default: lit('Overall'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lost', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('played', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('points', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('rank', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('scored', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('seasonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('teamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('won', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'competition_standings_dataSource_check_579a951a',
            "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'competition_teams',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('seasonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('teamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['seasonId', 'teamId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'competitions',
        columns: [
          col('competitionType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('coverUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataSource', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('foundedYear', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('lastSyncedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('logoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerLeagueId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('providerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('publicationStatus', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('seoDescription', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('seoTitle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('shortName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sportId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('websiteUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'competitions_dataSource_check_579a951a',
            "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
          ),
          checkExpression(
            'competitions_publicationStatus_check_b5329110',
            "\"publicationStatus\" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'discovery_aliases',
        columns: [
          col('alias', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('competitionId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('normalized', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('playerId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('teamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'player_careers',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataSource', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('jerseyNumber', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('joinedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('leftAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('playerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('teamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('transferType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'player_careers_dataSource_check_579a951a',
            "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'player_media',
        columns: [
          col('altText', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('caption', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('playerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('sourceUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'player_statistics',
        columns: [
          col('dataSource', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('metricKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metricLabel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metricValue', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('playerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('seasonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('teamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'player_statistics_dataSource_check_579a951a',
            "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'team_media',
        columns: [
          col('altText', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('caption', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('sourceUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('teamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_rooms',
        column: col('teamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('competitionSeasonId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('achievements', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('biography', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('dataSource', 'text', {
          notNull: true,
          default: lit('MANUAL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('dateOfBirth', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('heightCm', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('lastSyncedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('preferredFoot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('providerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('providerPlayerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('publicationStatus', 'text', {
          notNull: true,
          default: lit('DRAFT'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('publishedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('seoDescription', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('seoTitle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('sportId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'players',
        column: col('weightKg', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('dataSource', 'text', {
          notNull: true,
          default: lit('MANUAL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('foundedYear', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('lastSyncedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('nickname', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('overview', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('providerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('providerTeamId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('publicationStatus', 'text', {
          notNull: true,
          default: lit('DRAFT'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('publishedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('seoDescription', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('seoTitle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('stadiumCapacity', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('stadiumName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'teams',
        column: col('websiteUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'competition_seasons',
        constraint: 'competition_seasons_competitionId_name_key',
        columns: ['competitionId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'competition_standings',
        constraint: 'competition_standings_seasonId_teamId_groupName_key',
        columns: ['seasonId', 'teamId', 'groupName'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'competitions',
        constraint: 'competitions_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'competitions',
        constraint: 'competitions_providerName_providerLeagueId_key',
        columns: ['providerName', 'providerLeagueId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'discovery_aliases',
        constraint: 'discovery_aliases_teamId_normalized_key',
        columns: ['teamId', 'normalized'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'discovery_aliases',
        constraint: 'discovery_aliases_playerId_normalized_key',
        columns: ['playerId', 'normalized'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'discovery_aliases',
        constraint: 'discovery_aliases_competitionId_normalized_key',
        columns: ['competitionId', 'normalized'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'fan_rooms',
        constraint: 'fan_rooms_teamId_key',
        columns: ['teamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'player_statistics',
        constraint: 'player_statistics_playerId_teamId_seasonId_metricKey_key',
        columns: ['playerId', 'teamId', 'seasonId', 'metricKey'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'players',
        constraint: 'players_dataSource_check_579a951a',
        expression: "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'players',
        constraint: 'players_publicationStatus_check_b5329110',
        expression: "\"publicationStatus\" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'players',
        constraint: 'players_providerName_providerPlayerId_key',
        columns: ['providerName', 'providerPlayerId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'teams',
        constraint: 'teams_dataSource_check_579a951a',
        expression: "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'teams',
        constraint: 'teams_publicationStatus_check_b5329110',
        expression: "\"publicationStatus\" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'teams',
        constraint: 'teams_providerName_providerTeamId_key',
        columns: ['providerName', 'providerTeamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_seasons',
        index: 'competition_seasons_competitionId_idx_53fccd3b',
        columns: ['competitionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_seasons',
        index: 'competition_seasons_competitionId_isCurrent_idx_a80475ca',
        columns: ['competitionId', 'isCurrent'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_standings',
        index: 'competition_standings_seasonId_groupName_rank_idx_cedcf987',
        columns: ['seasonId', 'groupName', 'rank'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_standings',
        index: 'competition_standings_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_standings',
        index: 'competition_standings_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_teams',
        index: 'competition_teams_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_teams',
        index: 'competition_teams_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competitions',
        index: 'competitions_country_idx_c3994778',
        columns: ['country'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competitions',
        index: 'competitions_publicationStatus_idx_b9e8738a',
        columns: ['publicationStatus'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competitions',
        index: 'competitions_sportId_idx_2a876157',
        columns: ['sportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_aliases',
        index: 'discovery_aliases_competitionId_idx_53fccd3b',
        columns: ['competitionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_aliases',
        index: 'discovery_aliases_normalized_idx_323bea3e',
        columns: ['normalized'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_aliases',
        index: 'discovery_aliases_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_aliases',
        index: 'discovery_aliases_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'matches',
        index: 'matches_competitionSeasonId_idx_2e6f1c2a',
        columns: ['competitionSeasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_careers',
        index: 'player_careers_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_careers',
        index: 'player_careers_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_media',
        index: 'player_media_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_media',
        index: 'player_media_playerId_sortOrder_idx_a58bfb65',
        columns: ['playerId', 'sortOrder'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_statistics',
        index: 'player_statistics_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_statistics',
        index: 'player_statistics_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_statistics',
        index: 'player_statistics_seasonId_metricKey_idx_bcad9e80',
        columns: ['seasonId', 'metricKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'player_statistics',
        index: 'player_statistics_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'players',
        index: 'players_nationality_idx_1a6bf5fb',
        columns: ['nationality'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'players',
        index: 'players_publicationStatus_idx_b9e8738a',
        columns: ['publicationStatus'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'players',
        index: 'players_sportId_idx_2a876157',
        columns: ['sportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team_media',
        index: 'team_media_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team_media',
        index: 'team_media_teamId_sortOrder_idx_5c0ac284',
        columns: ['teamId', 'sortOrder'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teams',
        index: 'teams_country_idx_c3994778',
        columns: ['country'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teams',
        index: 'teams_publicationStatus_idx_b9e8738a',
        columns: ['publicationStatus'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_seasons',
        foreignKey: {
          name: 'competition_seasons_competitionId_fkey',
          columns: ['competitionId'],
          references: { schema: 'public', table: 'competitions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_standings',
        foreignKey: {
          name: 'competition_standings_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'competition_seasons', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_standings',
        foreignKey: {
          name: 'competition_standings_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_teams',
        foreignKey: {
          name: 'competition_teams_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'competition_seasons', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_teams',
        foreignKey: {
          name: 'competition_teams_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competitions',
        foreignKey: {
          name: 'competitions_sportId_fkey',
          columns: ['sportId'],
          references: { schema: 'public', table: 'sports', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'discovery_aliases',
        foreignKey: {
          name: 'discovery_aliases_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'discovery_aliases',
        foreignKey: {
          name: 'discovery_aliases_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'players', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'discovery_aliases',
        foreignKey: {
          name: 'discovery_aliases_competitionId_fkey',
          columns: ['competitionId'],
          references: { schema: 'public', table: 'competitions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'fan_rooms',
        foreignKey: {
          name: 'fan_rooms_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'matches',
        foreignKey: {
          name: 'matches_competitionSeasonId_fkey',
          columns: ['competitionSeasonId'],
          references: { schema: 'public', table: 'competition_seasons', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_careers',
        foreignKey: {
          name: 'player_careers_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'players', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_careers',
        foreignKey: {
          name: 'player_careers_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_media',
        foreignKey: {
          name: 'player_media_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'players', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_statistics',
        foreignKey: {
          name: 'player_statistics_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'players', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_statistics',
        foreignKey: {
          name: 'player_statistics_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'player_statistics',
        foreignKey: {
          name: 'player_statistics_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'competition_seasons', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'players',
        foreignKey: {
          name: 'players_sportId_fkey',
          columns: ['sportId'],
          references: { schema: 'public', table: 'sports', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'team_media',
        foreignKey: {
          name: 'team_media_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'teams', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
