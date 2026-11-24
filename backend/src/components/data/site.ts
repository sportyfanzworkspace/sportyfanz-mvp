export const matches = [
  {
    home: "Arsenal",
    away: "Chelsea",
    score: "2 - 1",
    time: "72'",
    league: "Premier League",
    image:
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  },

  {
    home: "Lakers",
    away: "Warriors",
    score: "68 - 72",
    time: "Q3",
    league: "NBA",
    image:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
  },

  {
    home: "Man Utd",
    away: "Liverpool",
    score: "1 - 1",
    time: "61'",
    league: "Premier League",
    image:
      "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=900&q=80",
  },
] as const;

export const fanMessages: {
  user: string;
  text: string;
  time: string;
  avatar: string;
}[] = [
  {
    user: "EmmyGunner",
    text: "Saka is on fire today! 🔥",
    time: "7:12 PM",
    avatar: "E",
  },

  {
    user: "BlueForever",
    text: "Chelsea will equalise soon.",
    time: "7:14 PM",
    avatar: "B",
  },

  {
    user: "KennyFC",
    text: "That goal was beautiful!",
    time: "7:16 PM",
    avatar: "K",
  },

  {
    user: "FootballQueen",
    text: "Who do you think will score next?",
    time: "7:18 PM",
    avatar: "F",
  },

  {
    user: "MikelFan",
    text: "Arsenal all the way! ❤️",
    time: "7:20 PM",
    avatar: "M",
  },
];