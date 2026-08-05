export type RangePreset = "today" | "7d" | "30d" | "custom";

export type DateRange = { from: Date; to: Date; preset: RangePreset };

// Presets are inherently bounded (30d max), but a custom range was passed
// straight through with no upper bound -- a shop with years of sales
// history picking a multi-year range (or an admin picking "combined"
// across several such shops) had no limit on rows fetched/held in memory
// for the report or the XLSX export. One year is generous for a manual
// look-back; anything longer should be pulled in year-sized chunks instead.
const MAX_CUSTOM_RANGE_DAYS = 366;

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
    const maxSpanMs = MAX_CUSTOM_RANGE_DAYS * 86400000;
    const clampedFrom = to.getTime() - from.getTime() > maxSpanMs ? new Date(to.getTime() - maxSpanMs) : from;
    return { from: clampedFrom, to, preset: "custom" };
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
