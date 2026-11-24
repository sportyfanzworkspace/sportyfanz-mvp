#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c473fc553bd6eba26bbc69dd79053b8d964b6b8d3f21770f05bb637efec3092e/contract';
import endContract from '../../snapshots/c473fc553bd6eba26bbc69dd79053b8d964b6b8d3f21770f05bb637efec3092e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cfbfd68ae5b65aaf52645cc2345d920d2521c2d687d3a286015e68542834f7a5/contract';
import startContract from '../../snapshots/cfbfd68ae5b65aaf52645cc2345d920d2521c2d687d3a286015e68542834f7a5/contract.json' with { type: 'json' };
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
        table: 'poll_options',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pollId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'poll_votes',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('optionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('pollId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'polls',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('pointsReward', 'int4', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('question', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
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
            'polls_status_check_61f4f2cf',
            "\"status\" IN ('DRAFT', 'ACTIVE', 'CLOSED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'poll_votes',
        constraint: 'poll_votes_pollId_userId_key',
        columns: ['pollId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'poll_options',
        index: 'poll_options_pollId_idx_c217e50b',
        columns: ['pollId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'poll_votes',
        index: 'poll_votes_optionId_idx_b1d5fce5',
        columns: ['optionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'poll_votes',
        index: 'poll_votes_pollId_idx_c217e50b',
        columns: ['pollId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'poll_votes',
        index: 'poll_votes_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'polls',
        index: 'polls_endsAt_idx_f63d30f0',
        columns: ['endsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'polls',
        index: 'polls_startsAt_idx_5ff0df68',
        columns: ['startsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'polls',
        index: 'polls_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'poll_options',
        foreignKey: {
          name: 'poll_options_pollId_fkey',
          columns: ['pollId'],
          references: { schema: 'public', table: 'polls', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'poll_votes',
        foreignKey: {
          name: 'poll_votes_pollId_fkey',
          columns: ['pollId'],
          references: { schema: 'public', table: 'polls', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'poll_votes',
        foreignKey: {
          name: 'poll_votes_optionId_fkey',
          columns: ['optionId'],
          references: { schema: 'public', table: 'poll_options', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'poll_votes',
        foreignKey: {
          name: 'poll_votes_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
