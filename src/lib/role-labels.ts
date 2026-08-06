export type ShopRole = "owner" | "staff";

// Display labels only -- the underlying role value stored in the
// database and used for every permission check is still "owner"/"staff".
// "Admin" here means "runs this specific branch," distinct from the
// business-wide owner managing multiple branches from Admin Overview.
export const ROLE_LABEL: Record<ShopRole, string> = {
  owner: "Admin",
  staff: "Staff",
};

// Longer label with a one-line description, for pickers that double as
// an explanation of what each access level can do (e.g. invite forms).
export const ROLE_LABEL_WITH_DESCRIPTION: Record<ShopRole, string> = {
  owner: "Admin — full access including reports, pricing, and billing",
  staff: "Staff — sell & restock only",
};
