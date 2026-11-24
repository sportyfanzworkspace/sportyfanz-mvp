export type GuestFan = {
  guestId: string;
  guestName: string;
};

const STORAGE_KEY = "sportyfanz_guest_fan_v1";

export function getGuestFan(): GuestFan {
  if (typeof window === "undefined") {
    throw new Error("Guest identity requires a browser.");
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed: unknown = JSON.parse(stored);

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "guestId" in parsed &&
        "guestName" in parsed &&
        typeof parsed.guestId === "string" &&
        typeof parsed.guestName === "string" &&
        /^[0-9a-f-]{36}$/i.test(parsed.guestId) &&
        /^Fan[0-9]{4,8}$/.test(parsed.guestName)
      ) {
        return {
          guestId: parsed.guestId,
          guestName: parsed.guestName,
        };
      }
    }
  } catch {
    // Browser storage may be unavailable.
  }

  const guest: GuestFan = {
    guestId: crypto.randomUUID(),
    guestName: `Fan${Math.floor(
      1000 + Math.random() * 9000
    )}`,
  };

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(guest)
    );
  } catch {
    // Guest chatting can still work without persistent storage.
  }

  return guest;
}
