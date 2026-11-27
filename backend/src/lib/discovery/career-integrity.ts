export class CareerIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareerIntegrityError";
  }
}

export type CareerPeriod = {
  joinedAt: string | null;
  leftAt: string | null;
};

export function parseCareerDate(
  value: string,
  label: string
): number {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new CareerIntegrityError(
      `${label} contains an invalid date.`
    );
  }

  return timestamp;
}

export function validateCareerPeriod(
  period: CareerPeriod,
  effectiveAt: string,
  allowUnknownStart = false
): void {
  const now = parseCareerDate(
    effectiveAt,
    "Effective date"
  );

  const start = period.joinedAt === null
    ? null
    : parseCareerDate(
        period.joinedAt,
        "Joining date"
      );

  const end = period.leftAt === null
    ? null
    : parseCareerDate(
        period.leftAt,
        "Departure date"
      );

  if (start === null && !allowUnknownStart) {
    throw new CareerIntegrityError(
      "The membership joining date is missing."
    );
  }

  if (start !== null && start > now) {
    throw new CareerIntegrityError(
      "The joining date cannot be in the future."
    );
  }

  if (end !== null && end > now) {
    throw new CareerIntegrityError(
      "The departure date cannot be in the future."
    );
  }

  if (
    start !== null &&
    end !== null &&
    end < start
  ) {
    throw new CareerIntegrityError(
      "The departure date cannot precede the joining date."
    );
  }
}

export function sameCareerDate(
  first: string | null,
  second: string | null
): boolean {
  if (first === null || second === null) {
    return first === second;
  }

  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);

  return (
    Number.isFinite(firstTime) &&
    Number.isFinite(secondTime) &&
    firstTime === secondTime
  );
}

export function sameCareerPeriod(
  first: CareerPeriod,
  second: CareerPeriod
): boolean {
  return (
    sameCareerDate(first.joinedAt, second.joinedAt) &&
    sameCareerDate(first.leftAt, second.leftAt)
  );
}

// Compare periods belonging to the same player and club.
// Adjacent periods may share an end/start timestamp.
// Unknown joining dates cannot establish a definite overlap.
export function careerPeriodsOverlap(
  first: CareerPeriod,
  second: CareerPeriod
): boolean {
  if (
    first.joinedAt === null ||
    second.joinedAt === null
  ) {
    return false;
  }

  const firstStart = parseCareerDate(
    first.joinedAt,
    "First joining date"
  );

  const secondStart = parseCareerDate(
    second.joinedAt,
    "Second joining date"
  );

  const firstEnd = first.leftAt === null
    ? Number.POSITIVE_INFINITY
    : parseCareerDate(
        first.leftAt,
        "First departure date"
      );

  const secondEnd = second.leftAt === null
    ? Number.POSITIVE_INFINITY
    : parseCareerDate(
        second.leftAt,
        "Second departure date"
      );

  return (
    Math.max(firstStart, secondStart) <
    Math.min(firstEnd, secondEnd)
  );
}
