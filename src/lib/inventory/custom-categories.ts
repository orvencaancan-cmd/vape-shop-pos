import type { createClient } from "@/lib/supabase/server";
import type { ProductCategoryConfig } from "./product-categories";

// Maps a custom_categories row into the same shape the hardcoded
// PRODUCT_CATEGORIES entries use, so every consumer (picker grid, batch
// form, filter tabs, variant-dimension lookup) can treat a custom category
// identically to a built-in one. key is the row's own id -- the batch flow
// already threads categoryKey through as an opaque string, so a uuid key
// works exactly like "cartridge" or "wire" does today.
function toConfig(row: {
  id: string;
  label: string;
  variant_label: string | null;
  variant_input_type: string | null;
  variant_options: unknown;
}): ProductCategoryConfig {
  const options = Array.isArray(row.variant_options) ? (row.variant_options as string[]) : [];
  return {
    key: row.id,
    label: row.label,
    dbCategory: row.label,
    listLabel: "Name",
    listHelp: "One product per line.",
    nameTemplate: (name) => name,
    setForDevice: false,
    variantDimension:
      row.variant_input_type === "checklist"
        ? {
            label: row.variant_label ?? "Options",
            field: "size",
            inputType: "checklist",
            options: options.map((v) => ({ value: v, label: v })),
          }
        : row.variant_input_type === "freeText"
          ? {
              label: row.variant_label ?? "Tag",
              field: "size",
              inputType: "freeText",
              placeholder: `e.g. your own ${(row.variant_label ?? "tag").toLowerCase()} values`,
            }
          : undefined,
  };
}

export async function fetchCustomCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ProductCategoryConfig[]> {
  const { data } = await supabase
    .from("custom_categories")
    .select("id, label, variant_label, variant_input_type, variant_options")
    .eq("archived", false)
    .order("created_at");
  return (data ?? []).map(toConfig);
}

export async function getCustomCategoryConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<ProductCategoryConfig | undefined> {
  const { data } = await supabase
    .from("custom_categories")
    .select("id, label, variant_label, variant_input_type, variant_options")
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  return data ? toConfig(data) : undefined;
}
