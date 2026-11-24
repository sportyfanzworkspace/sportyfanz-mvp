#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ca626f5cb2dada5119c7c20027c8f9f214a6966eb79723458352d53fae939879/contract';
import startContract from '../../snapshots/ca626f5cb2dada5119c7c20027c8f9f214a6966eb79723458352d53fae939879/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e924d44dacd8de11f99941f90a707448a2ff63a47f9e5ce498b39612a822fc8f/contract';
import endContract from '../../snapshots/e924d44dacd8de11f99941f90a707448a2ff63a47f9e5ce498b39612a822fc8f/contract.json' with { type: 'json' };
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
        table: 'admin_users',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastLoginAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('mustChangePassword', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('ADMIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('admin_users_role_check_1954e8c0', "\"role\" IN ('USER', 'ADMIN')"),
          checkExpression(
            'admin_users_status_check_3a7c0f48',
            "\"status\" IN ('ACTIVE', 'SUSPENDED', 'DELETED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'admin_users',
        constraint: 'admin_users_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'admin_users',
        constraint: 'admin_users_username_key',
        columns: ['username'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
