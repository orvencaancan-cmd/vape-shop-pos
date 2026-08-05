/**
 * Builds a display label for a variant from its dimension fields (flavor,
 * nicotine strength, size, target device, resistance) -- the canonical
 * version, previously reimplemented independently in 6 places across
 * reports, the Sell screen, the audit screen, and inventory. Any future
 * variant dimension only needs adding here.
 */
export function variantLabel(v: {
  flavor?: string | null;
  nicotine_mg?: number | null;
  size?: string | null;
  for_device?: string | null;
  ohms?: number | null;
}) {
  return (
    [
      v.flavor,
      v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null,
      v.size,
      v.for_device ? `For ${v.for_device}` : null,
      v.ohms != null ? `${v.ohms}Ω` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Default"
  );
}
