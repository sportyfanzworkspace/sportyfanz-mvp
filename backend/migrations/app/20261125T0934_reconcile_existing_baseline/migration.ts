#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c8da2651bb3e67a86f986aac772464998a93ba673967b640433f84af3db0f659/contract';
import endContract from '../../snapshots/c8da2651bb3e67a86f986aac772464998a93ba673967b640433f84af3db0f659/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e146bb01e068b30e732c814eec37a4037ff8e810169db1a534426fb6fd6f0120/contract';
import startContract from '../../snapshots/e146bb01e068b30e732c814eec37a4037ff8e810169db1a534426fb6fd6f0120/contract.json' with { type: 'json' };
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
        table: 'admin_password_reset_tokens',
        columns: [
          col('adminUserId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'email_verification_codes',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'guest_poll_votes',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('guestTokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('optionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('pollId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'kyc_submissions',
        columns: [
          col('country', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dateOfBirth', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('reviewedByUserId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sex', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('whatsappNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('kyc_submissions_sex_check_c47af510', "\"sex\" IN ('FEMALE', 'MALE')"),
          checkExpression(
            'kyc_submissions_status_check_56005a61',
            "\"status\" IN ('PENDING', 'APPROVED', 'REJECTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'news_article_likes',
        columns: [
          col('articleUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('guestTokenHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'news_comment_likes',
        columns: [
          col('commentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'news_comments',
        columns: [
          col('articleUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('guestName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('guestTokenHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('parentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'news_views',
        columns: [
          col('articleUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('visitorKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'progression_awards',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('points', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('taskKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'trivia_quizzes',
        columns: [
          col('coverImageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'trivia_quizzes_status_check_61f4f2cf',
            "\"status\" IN ('DRAFT', 'ACTIVE', 'CLOSED')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'admin_users',
        column: col('sessionVersion', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_profiles',
        column: col('progressionPoints', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_room_messages',
        column: col('guestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_room_messages',
        column: col('guestName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_rooms',
        column: col('apiFootballFixtureId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_rooms',
        column: col('providerFixtureId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'fan_rooms',
        column: col('sport', 'text', {
          notNull: true,
          default: lit('football'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('predictionClosesAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('predictionsClosedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'polls',
        column: col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('explanation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('questionOrder', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('quizId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'trivia_questions',
        column: col('startsAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('dateOfBirth', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('firstName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('lastName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('sex', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('state', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('whatsappNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'fan_room_messages', column: 'userId' }),
      this.addUnique({
        schema: 'public',
        table: 'admin_password_reset_tokens',
        constraint: 'admin_password_reset_tokens_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'email_verification_codes',
        constraint: 'email_verification_codes_userId_key',
        columns: ['userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'fan_rooms',
        constraint: 'fan_rooms_apiFootballFixtureId_key',
        columns: ['apiFootballFixtureId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'fan_rooms',
        constraint: 'fan_rooms_sport_providerFixtureId_key',
        columns: ['sport', 'providerFixtureId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'guest_poll_votes',
        constraint: 'guest_poll_votes_pollId_guestTokenHash_key',
        columns: ['pollId', 'guestTokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'news_article_likes',
        constraint: 'news_article_likes_articleUrl_userId_key',
        columns: ['articleUrl', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'news_article_likes',
        constraint: 'news_article_likes_articleUrl_guestTokenHash_key',
        columns: ['articleUrl', 'guestTokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'news_comment_likes',
        constraint: 'news_comment_likes_commentId_userId_key',
        columns: ['commentId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'progression_awards',
        constraint: 'progression_awards_userId_taskKey_key',
        columns: ['userId', 'taskKey'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_sex_check_c47af510',
        expression: "\"sex\" IN ('FEMALE', 'MALE')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'admin_password_reset_tokens',
        index: 'admin_password_reset_tokens_adminUserId_idx_0ce093a3',
        columns: ['adminUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'admin_password_reset_tokens',
        index: 'admin_password_reset_tokens_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'fan_room_messages',
        index: 'fan_room_messages_guestId_idx_39c95865',
        columns: ['guestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guest_poll_votes',
        index: 'guest_poll_votes_optionId_idx_b1d5fce5',
        columns: ['optionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guest_poll_votes',
        index: 'guest_poll_votes_pollId_idx_c217e50b',
        columns: ['pollId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'kyc_submissions',
        index: 'kyc_submissions_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'kyc_submissions',
        index: 'kyc_submissions_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'kyc_submissions',
        index: 'kyc_submissions_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_article_likes',
        index: 'news_article_likes_articleUrl_idx_52fec833',
        columns: ['articleUrl'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_article_likes',
        index: 'news_article_likes_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comment_likes',
        index: 'news_comment_likes_commentId_idx_b5a4f615',
        columns: ['commentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comment_likes',
        index: 'news_comment_likes_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comments',
        index: 'news_comments_articleUrl_createdAt_idx_efc1ce87',
        columns: ['articleUrl', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comments',
        index: 'news_comments_articleUrl_guestTokenHash_idx_0e05ab3d',
        columns: ['articleUrl', 'guestTokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comments',
        index: 'news_comments_parentId_idx_6a68f597',
        columns: ['parentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_comments',
        index: 'news_comments_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_views',
        index: 'news_views_articleUrl_createdAt_idx_efc1ce87',
        columns: ['articleUrl', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_views',
        index: 'news_views_articleUrl_visitorKey_idx_a9ba95c1',
        columns: ['articleUrl', 'visitorKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_views',
        index: 'news_views_userId_articleUrl_idx_80a8811e',
        columns: ['userId', 'articleUrl'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'news_views',
        index: 'news_views_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'progression_awards',
        index: 'progression_awards_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'progression_awards',
        index: 'progression_awards_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_questions',
        index: 'trivia_questions_quizId_idx_c721979c',
        columns: ['quizId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_questions',
        index: 'trivia_questions_quizId_questionOrder_idx_90344e95',
        columns: ['quizId', 'questionOrder'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trivia_quizzes',
        index: 'trivia_quizzes_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guest_poll_votes',
        foreignKey: {
          name: 'guest_poll_votes_pollId_fkey',
          columns: ['pollId'],
          references: { schema: 'public', table: 'polls', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guest_poll_votes',
        foreignKey: {
          name: 'guest_poll_votes_optionId_fkey',
          columns: ['optionId'],
          references: { schema: 'public', table: 'poll_options', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'kyc_submissions',
        foreignKey: {
          name: 'kyc_submissions_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_article_likes',
        foreignKey: {
          name: 'news_article_likes_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_comment_likes',
        foreignKey: {
          name: 'news_comment_likes_commentId_fkey',
          columns: ['commentId'],
          references: { schema: 'public', table: 'news_comments', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_comment_likes',
        foreignKey: {
          name: 'news_comment_likes_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_comments',
        foreignKey: {
          name: 'news_comments_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_comments',
        foreignKey: {
          name: 'news_comments_parentId_fkey',
          columns: ['parentId'],
          references: { schema: 'public', table: 'news_comments', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'news_views',
        foreignKey: {
          name: 'news_views_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'progression_awards',
        foreignKey: {
          name: 'progression_awards_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trivia_questions',
        foreignKey: {
          name: 'trivia_questions_quizId_fkey',
          columns: ['quizId'],
          references: { schema: 'public', table: 'trivia_quizzes', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
