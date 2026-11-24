import dotenv from "dotenv";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

dotenv.config({ path: ".env.local" });

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});