#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/85af20f5e9cabf90c5e02a6670d1fcef48c953d22ce16ae31e5bb967e9946337/contract';
import endContract from '../../snapshots/85af20f5e9cabf90c5e02a6670d1fcef48c953d22ce16ae31e5bb967e9946337/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e924d44dacd8de11f99941f90a707448a2ff63a47f9e5ce498b39612a822fc8f/contract';
import startContract from '../../snapshots/e924d44dacd8de11f99941f90a707448a2ff63a47f9e5ce498b39612a822fc8f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'admin_users',
        column: col('staffRole', 'text', {
          notNull: true,
          default: lit('SUPER_ADMIN'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
