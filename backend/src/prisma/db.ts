import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured.');
}

export const db = postgres<Contract>({
  contractJson,
  binding: {
    kind: 'url',
    url: databaseUrl,
  },
});