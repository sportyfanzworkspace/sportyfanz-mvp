#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c473fc553bd6eba26bbc69dd79053b8d964b6b8d3f21770f05bb637efec3092e/contract';
import startContract from '../../snapshots/c473fc553bd6eba26bbc69dd79053b8d964b6b8d3f21770f05bb637efec3092e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e8d4625abe2f329cabe6348b450e3ac14ea30ad72af360272fa591670ea996bb/contract';
import endContract from '../../snapshots/e8d4625abe2f329cabe6348b450e3ac14ea30ad72af360272fa591670ea996bb/contract.json' with { type: 'json' };
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
        table: 'trivia_attempts',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isCorrect', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('pointsAwarded', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('questionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('selectedOption', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'trivia_questions',
        columns: [
          col('correctOption', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('optionA', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('optionB', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('optionC', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('optionD', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pointsReward', 'int4', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('question', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'trivia_questions_status_check_61f4f2cf',
            "\"status\" IN ('DRAFT', 'ACTIVE', 'CLOSED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'trivia_attempts',
        constraint: 'trivia_attempts_questionId_userId_key',
        columns: ['questionId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_attempts',
        index: 'trivia_attempts_questionId_idx_fdb42076',
        columns: ['questionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_attempts',
        index: 'trivia_attempts_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_attempts',
        index: 'trivia_attempts_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_questions',
        index: 'trivia_questions_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_attempts',
        foreignKey: {
          name: 'trivia_attempts_questionId_fkey',
          columns: ['questionId'],
          references: { schema: 'public', table: 'trivia_questions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_attempts',
        foreignKey: {
          name: 'trivia_attempts_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
