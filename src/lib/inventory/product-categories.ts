// Replaces the old two-level "Accessory > subcategory" scheme -- every
// former accessory subcategory is now a first-class product category in
// its own right, stored directly in products.category (see migration
// 0047_product_categories.sql). "ejuice" isn't listed here since it has
// its own dedicated flow (Add E-juice) and no variant-dimension config;
// this list covers everything else, including "Other" as the catch-all
// for anything that doesn't fit one of the specific types.

export type ProductCategoryKey =
  | "cartridge"
  | "flavor-pod"
  | "device"
  | "pod-device"
  | "wire"
  | "cotton"
  | "other";

type ChecklistDimension = {
  label: string;
  field: "ohms" | "size" | "flavor";
  inputType: "checklist";
  options: { value: string; label: string }[];
  formatValue?: (raw: string) => string;
};

type FreeTextDimension = {
  label: string;
  field: "ohms" | "size" | "flavor";
  inputType: "freeText";
  placeholder: string;
  formatValue?: (raw: string) => string;
};

export type ProductCategoryConfig = {
  key: ProductCategoryKey;
  label: string;
  dbCategory: string;
  listLabel: string;
  listHelp: string;
  nameTemplate: (listValue: string) => string;
  setForDevice: boolean;
  variantDimension?: ChecklistDimension | FreeTextDimension;
};

export const PRODUCT_CATEGORIES: ProductCategoryConfig[] = [
  {
    key: "cartridge",
    label: "Cartridge",
    dbCategory: "Cartridge",
    listLabel: "For what device",
    listHelp: "One device per line — each becomes its own product.",
    nameTemplate: (device) => `${device} Cartridge`,
    setForDevice: true,
    variantDimension: {
      label: "Ohms",
      field: "ohms",
      inputType: "checklist",
      options: ["0.4", "0.6", "0.8"].map((v) => ({ value: v, label: `${v}Ω` })),
    },
  },
  {
    key: "flavor-pod",
    label: "Flavor Pods",
    dbCategory: "Flavor Pod",
    listLabel: "For what device",
    listHelp: "One device per line — each becomes its own product.",
    nameTemplate: (device) => `${device} Flavor Pod`,
    setForDevice: true,
    variantDimension: {
      label: "Flavor",
      field: "flavor",
      inputType: "freeText",
      placeholder: "e.g. Mango Ice, Mint, Watermelon",
    },
  },
  {
    key: "device",
    label: "Device",
    dbCategory: "Device",
    listLabel: "Model",
    listHelp: "One model per line — each becomes its own product.",
    nameTemplate: (model) => model,
    setForDevice: false,
    variantDimension: {
      label: "Color",
      field: "size",
      inputType: "freeText",
      placeholder: "e.g. Black, Silver, Rose Gold",
    },
  },
  {
    key: "pod-device",
    label: "Pod Device",
    dbCategory: "Pod Device",
    listLabel: "Model",
    listHelp: "One model per line — each becomes its own product.",
    nameTemplate: (model) => model,
    setForDevice: false,
  },
  {
    key: "wire",
    label: "Wire",
    dbCategory: "Wire",
    listLabel: "Type",
    listHelp: "One wire type per line — each becomes its own product.",
    nameTemplate: (type) => type,
    setForDevice: false,
    variantDimension: {
      label: "Gauge",
      field: "size",
      inputType: "checklist",
      options: ["22", "24", "26", "28", "30", "32"].map((v) => ({ value: v, label: `${v}g` })),
      formatValue: (raw) => `${raw}g`,
    },
  },
  {
    key: "cotton",
    label: "Cotton",
    dbCategory: "Cotton",
    listLabel: "Name",
    listHelp: "One product per line.",
    nameTemplate: (name) => name,
    setForDevice: false,
  },
  {
    key: "other",
    label: "Other",
    dbCategory: "Other",
    listLabel: "Name",
    listHelp: "One product per line.",
    nameTemplate: (name) => name,
    setForDevice: false,
  },
];

// The full set of valid products.category values, ejuice included --
// shared by Zod schemas and anywhere a flat "which categories exist" list
// is needed (filter tabs, category pickers).
export const ALL_CATEGORIES = ["ejuice", ...PRODUCT_CATEGORIES.map((c) => c.dbCategory)];

export function getProductCategory(key: string): ProductCategoryConfig | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.key === key);
}

export function getProductCategoryByDbName(dbCategory: string): ProductCategoryConfig | undefined {
  const normalized = dbCategory.trim().toLowerCase();
  return PRODUCT_CATEGORIES.find((c) => c.dbCategory.toLowerCase() === normalized);
}

export function categoryLabel(dbCategory: string): string {
  if (dbCategory === "ejuice") return "E-juice";
  return getProductCategoryByDbName(dbCategory)?.label ?? dbCategory;
}
