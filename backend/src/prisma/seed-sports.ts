import { db } from "./db";

const sports = [
  {
    name: "Football",
    slug: "football",
    description: "Football matches, teams, and fan communities.",
    iconUrl: "⚽",
  },
  {
    name: "Basketball",
    slug: "basketball",
    description: "Basketball leagues, teams, and match updates.",
    iconUrl: "🏀",
  },
  {
    name: "Tennis",
    slug: "tennis",
    description: "Tennis tournaments and player updates.",
    iconUrl: "🎾",
  },
  {
    name: "Cricket",
    slug: "cricket",
    description: "Cricket matches, teams, and tournaments.",
    iconUrl: "🏏",
  },
  {
    name: "Rugby",
    slug: "rugby",
    description: "Rugby matches and fan communities.",
    iconUrl: "🏉",
  },
  {
    name: "Volleyball",
    slug: "volleyball",
    description: "Volleyball matches and competitions.",
    iconUrl: "🏐",
  },
  {
    name: "Baseball",
    slug: "baseball",
    description: "Baseball games, teams, and leagues.",
    iconUrl: "⚾",
  },
  {
    name: "Badminton",
    slug: "badminton",
    description: "Badminton tournaments and players.",
    iconUrl: "🏸",
  },
  {
    name: "Formula 1",
    slug: "formula-1",
    description: "Formula 1 races, drivers, and teams.",
    iconUrl: "🏎️",
  },
  {
    name: "Athletics",
    slug: "athletics",
    description: "Track and field competitions.",
    iconUrl: "🏃",
  },
];

async function main() {
  const existingSports = await db.orm.public.Sport.all();

  for (const sport of sports) {
    const existing = existingSports.find(
      (item) => item.slug === sport.slug
    );

    if (existing) {
      console.log(`Already exists: ${sport.name}`);
      continue;
    }

    await db.orm.public.Sport.create({
      ...sport,
      isActive: true,
    });

    console.log(`Created: ${sport.name}`);
  }

  console.log("Sports catalog seed completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
  