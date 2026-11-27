#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4b86ab5c8a6c0dd05a717563ccef3ee2e4644b9da35e046e8e2d3f10f9219f58/contract';
import startContract from '../../snapshots/4b86ab5c8a6c0dd05a717563ccef3ee2e4644b9da35e046e8e2d3f10f9219f58/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9f8576fa90dcd41a38921185e96d8bdff078395c6206746c03632424e5c27517/contract';
import endContract from '../../snapshots/9f8576fa90dcd41a38921185e96d8bdff078395c6206746c03632424e5c27517/contract.json' with { type: 'json' };
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
        table: 'discovery_provider_cache',
        columns: [
          col('cacheKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endpoint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('fetchedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('payload', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payloadBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('providerName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['cacheKey'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'discovery_provider_quotas',
        columns: [
          col('accessRestricted', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('cooldownUntil', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dailyLimit', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('dailyRemaining', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('lastErrorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lockExpiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lockToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('minuteLimit', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('minuteRemaining', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('observedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('quotaKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['quotaKey'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'discovery_sync_jobs',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('checkpoint', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('heartbeatAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('jobKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('jobType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastErrorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lockExpiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lockToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('maxAttempts', 'int4', {
            notNull: true,
            default: lit(3),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('nextRetryAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('parameters', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priority', 'int4', {
            notNull: true,
            default: lit(100),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('providerName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recordsConflicted', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recordsCreated', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recordsProcessed', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recordsSkipped', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recordsUpdated', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('scheduledAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('sportSlug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'discovery_sync_jobs_status_check_5efaf795',
            "\"status\" IN ('PENDING', 'RUNNING', 'RETRY', 'COMPLETED', 'FAILED', 'CANCELLED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'discovery_sync_jobs',
        constraint: 'discovery_sync_jobs_jobKey_key',
        columns: ['jobKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_provider_cache',
        index: 'discovery_provider_cache_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_provider_cache',
        index: 'discovery_provider_cache_providerName_endpoint_idx_8a54ab6a',
        columns: ['providerName', 'endpoint'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_sync_jobs',
        index: 'discovery_sync_jobs_providerName_status_idx_d0becd57',
        columns: ['providerName', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_sync_jobs',
        index: 'discovery_sync_jobs_sportSlug_jobType_idx_a128776a',
        columns: ['sportSlug', 'jobType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_sync_jobs',
        index: 'discovery_sync_jobs_status_lockExpiresAt_idx_fbaeb482',
        columns: ['status', 'lockExpiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_sync_jobs',
        index: 'discovery_sync_jobs_status_nextRetryAt_idx_58d36316',
        columns: ['status', 'nextRetryAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'discovery_sync_jobs',
        index: 'discovery_sync_jobs_status_scheduledAt_idx_62252894',
        columns: ['status', 'scheduledAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
