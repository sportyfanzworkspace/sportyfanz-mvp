#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ca626f5cb2dada5119c7c20027c8f9f214a6966eb79723458352d53fae939879/contract';
import endContract from '../../snapshots/ca626f5cb2dada5119c7c20027c8f9f214a6966eb79723458352d53fae939879/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e8d4625abe2f329cabe6348b450e3ac14ea30ad72af360272fa591670ea996bb/contract';
import startContract from '../../snapshots/e8d4625abe2f329cabe6348b450e3ac14ea30ad72af360272fa591670ea996bb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('mustChangePassword', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
