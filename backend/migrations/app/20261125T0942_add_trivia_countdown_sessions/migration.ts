#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c8da2651bb3e67a86f986aac772464998a93ba673967b640433f84af3db0f659/contract';
import startContract from '../../snapshots/c8da2651bb3e67a86f986aac772464998a93ba673967b640433f84af3db0f659/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/da6226bdb051a353bbc2d68c8f89fe148e4c55e26157c5d4814897630009d1ae/contract';
import endContract from '../../snapshots/da6226bdb051a353bbc2d68c8f89fe148e4c55e26157c5d4814897630009d1ae/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'trivia_sessions',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('durationSeconds', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('questionId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('quizId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'trivia_session_completion_check_3e64cd05',
            '"completedAt" IS NULL OR ("completedAt" >= "startedAt" AND "completedAt" <= "expiresAt")',
          ),
          checkExpression(
            'trivia_session_duration_check_92dcd0be',
            '("questionId" IS NOT NULL AND "durationSeconds" BETWEEN 10 AND 600) OR ("quizId" IS NOT NULL AND "durationSeconds" BETWEEN 30 AND 3600)',
          ),
          checkExpression('trivia_session_expiry_check_d11bec3f', '"expiresAt" > "startedAt"'),
          checkExpression(
            'trivia_session_max_expiry_check_ba652e41',
            '"expiresAt" <= "startedAt" + "durationSeconds" * INTERVAL \'1 second\'',
          ),
          checkExpression(
            'trivia_session_target_check_eb0b64e4',
            '("questionId" IS NOT NULL AND "quizId" IS NULL) OR ("questionId" IS NULL AND "quizId" IS NOT NULL)',
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('durationSeconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_quizzes',
        column: col('durationSeconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'trivia_questions',
        constraint: 'trivia_question_duration_check_40c45e4e',
        expression: '"durationSeconds" IS NULL OR "durationSeconds" BETWEEN 10 AND 600',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'trivia_questions',
        constraint: 'trivia_question_quiz_timer_check_cb9dad47',
        expression: '"quizId" IS NULL OR "durationSeconds" IS NULL',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'trivia_quizzes',
        constraint: 'trivia_quiz_duration_check_cad6701c',
        expression: '"durationSeconds" IS NULL OR "durationSeconds" BETWEEN 30 AND 3600',
      }),
      this.addUnique({
        schema: 'public',
        table: 'trivia_sessions',
        constraint: 'trivia_sessions_userId_questionId_key',
        columns: ['userId', 'questionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'trivia_sessions',
        constraint: 'trivia_sessions_userId_quizId_key',
        columns: ['userId', 'quizId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_sessions',
        index: 'trivia_sessions_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_sessions',
        index: 'trivia_sessions_questionId_idx_fdb42076',
        columns: ['questionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_sessions',
        index: 'trivia_sessions_quizId_idx_c721979c',
        columns: ['quizId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_sessions',
        index: 'trivia_sessions_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_sessions',
        foreignKey: {
          name: 'trivia_sessions_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_sessions',
        foreignKey: {
          name: 'trivia_sessions_questionId_fkey',
          columns: ['questionId'],
          references: { schema: 'public', table: 'trivia_questions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_sessions',
        foreignKey: {
          name: 'trivia_sessions_quizId_fkey',
          columns: ['quizId'],
          references: { schema: 'public', table: 'trivia_quizzes', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
