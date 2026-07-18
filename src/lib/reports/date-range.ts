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

  const to = new Date(now.getTime() + 86400000);
  let from: Date;
  if (preset === "today") {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (preset === "30d") {
    from = new Date(now.getTime() - 30 * 86400000);
  } else {
    from = new Date(now.getTime() - 7 * 86400000);
  }
  return { from, to, preset };
}
