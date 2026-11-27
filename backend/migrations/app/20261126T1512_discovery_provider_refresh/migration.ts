#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9f8576fa90dcd41a38921185e96d8bdff078395c6206746c03632424e5c27517/contract';
import startContract from '../../snapshots/9f8576fa90dcd41a38921185e96d8bdff078395c6206746c03632424e5c27517/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fb7aabe97435b6bbf2c27da15dc4bfb749eca68da8a15b9631c8af028a1684fc/contract';
import endContract from '../../snapshots/fb7aabe97435b6bbf2c27da15dc4bfb749eca68da8a15b9631c8af028a1684fc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'competition_standings',
        column: col('providerObservedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_statistics',
        column: col('providerObservedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
