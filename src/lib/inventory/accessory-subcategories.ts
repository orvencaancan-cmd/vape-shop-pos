export type AccessorySubcategoryKey =
  | "cartridge"
  | "flavor-pod"
  | "device"
  | "pod-device"
  | "wire"
  | "cotton";

type ChecklistDimension = {
  label: string;
  field: "ohms" | "size";
  inputType: "checklist";
  options: { value: string; label: string }[];
  formatValue?: (raw: string) => string;
};

type FreeTextDimension = {
  label: string;
  field: "ohms" | "size";
  inputType: "freeText";
  placeholder: string;
  formatValue?: (raw: string) => string;
};

export type AccessorySubcategoryConfig = {
  key: AccessorySubcategoryKey;
  label: string;
  dbSubcategory: string;
  listLabel: string;
  listHelp: string;
  nameTemplate: (listValue: string) => string;
  setForDevice: boolean;
  variantDimension?: ChecklistDimension | FreeTextDimension;
};

export const ACCESSORY_SUBCATEGORIES: AccessorySubcategoryConfig[] = [
  {
    key: "cartridge",
    label: "Cartridge",
    dbSubcategory: "Cartridge",
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
    dbSubcategory: "Flavor Pod",
    listLabel: "For what device",
    listHelp: "One device per line — each becomes its own product.",
    nameTemplate: (device) => `${device} Flavor Pod`,
    setForDevice: true,
  },
  {
    key: "device",
    label: "Device",
    dbSubcategory: "Device",
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
    dbSubcategory: "Pod Device",
    listLabel: "Model",
    listHelp: "One model per line — each becomes its own product.",
    nameTemplate: (model) => model,
    setForDevice: false,
  },
  {
    key: "wire",
    label: "Wire",
    dbSubcategory: "Wire",
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
    dbSubcategory: "Cotton",
    listLabel: "Name",
    listHelp: "One product per line.",
    nameTemplate: (name) => name,
    setForDevice: false,
  },
];

export function getAccessorySubcategory(key: string): AccessorySubcategoryConfig | undefined {
  return ACCESSORY_SUBCATEGORIES.find((s) => s.key === key);
}

export function getAccessorySubcategoryByDbName(
  dbSubcategory: string,
): AccessorySubcategoryConfig | undefined {
  const normalized = dbSubcategory.trim().toLowerCase();
  return ACCESSORY_SUBCATEGORIES.find((s) => s.dbSubcategory.toLowerCase() === normalized);
}
