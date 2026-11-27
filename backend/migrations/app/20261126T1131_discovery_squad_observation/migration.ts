#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4b86ab5c8a6c0dd05a717563ccef3ee2e4644b9da35e046e8e2d3f10f9219f58/contract';
import endContract from '../../snapshots/4b86ab5c8a6c0dd05a717563ccef3ee2e4644b9da35e046e8e2d3f10f9219f58/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c5cd03e6bc68cad1ddf2ad42e737c2bb138e771979a4acaa852dc0b736cea5fe/contract';
import startContract from '../../snapshots/c5cd03e6bc68cad1ddf2ad42e737c2bb138e771979a4acaa852dc0b736cea5fe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropDefault({ schema: 'public', table: 'player_teams', column: 'joinedAt' }),
      this.addColumn({
        schema: 'public',
        table: 'player_teams',
        column: col('dataSource', 'text', {
          notNull: true,
          default: lit('MANUAL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_teams',
        column: col('observedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.dropNotNull({ schema: 'public', table: 'player_teams', column: 'joinedAt' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'player_teams',
        constraint: 'player_teams_dataSource_check_579a951a',
        expression: "\"dataSource\" IN ('MANUAL', 'PROVIDER')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
