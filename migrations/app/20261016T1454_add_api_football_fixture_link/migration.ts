#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/85af20f5e9cabf90c5e02a6670d1fcef48c953d22ce16ae31e5bb967e9946337/contract';
import startContract from '../../snapshots/85af20f5e9cabf90c5e02a6670d1fcef48c953d22ce16ae31e5bb967e9946337/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e146bb01e068b30e732c814eec37a4037ff8e810169db1a534426fb6fd6f0120/contract';
import endContract from '../../snapshots/e146bb01e068b30e732c814eec37a4037ff8e810169db1a534426fb6fd6f0120/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('apiFootballFixtureId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'matches',
        column: col('matchDataSource', 'text', {
          default: lit('MANUAL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'reward_redemptions',
        column: col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'matches',
        constraint: 'matches_apiFootballFixtureId_key',
        columns: ['apiFootballFixtureId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
