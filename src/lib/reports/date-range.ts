export type RangePreset = "today" | "7d" | "30d" | "custom";

export type DateRange = { from: Date; to: Date; preset: RangePreset };

/**
 * Resolves a report date range from URL search params. "to" is always an
 * exclusive upper bound (start of the day after the last included day) so
 * range queries can use a plain `< to` comparison.
 */
export function resolveRange(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const now = new Date();

  if (searchParams.range === "custom" && searchParams.from && searchParams.to) {
    const from = new Date(`${searchParams.from}T00:00:00.000Z`);
    const to = new Date(new Date(`${searchParams.to}T00:00:00.000Z`).getTime() + 86400000);
    return { from, to, preset: "custom" };
  }

  const preset: RangePreset =
    searchParams.range === "today" || searchParams.range === "30d" ? searchParams.range : "7d";

  // Calendar-day aligned, matching the dashboard's computeDailySeries --
  // "last N days" means N calendar days including today, not a rolling
  // N*24h window from this exact moment (which used to drift onto a
  // partial extra day and disagree with the dashboard's own figures).
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(todayStart.getTime() + 86400000);
  let from: Date;
  if (preset === "today") {
    from = todayStart;
  } else if (preset === "30d") {
    from = new Date(todayStart.getTime() - 29 * 86400000);
  } else {
    from = new Date(todayStart.getTime() - 6 * 86400000);
  }
  return { from, to, preset };
}
