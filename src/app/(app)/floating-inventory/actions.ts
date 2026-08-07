"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type ActionResult = { error?: string };

export async function addFloatingStockAction(input: {
  category: "ejuice" | "accessory";
  brand: string | null;
  productName: string;
  subcategory: string | null;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
  sku: string | null;
  quantity: number;
  cost: number | null;
  price: number | null;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage floating inventory" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_floating_stock", {
    p_category: input.category,
    p_brand: input.brand,
    p_product_name: input.productName,
    p_subcategory: input.subcategory,
    p_flavor: input.flavor,
    p_nicotine_mg: input.nicotineMg,
    p_size: input.size,
    p_for_device: input.forDevice,
    p_ohms: input.ohms,
    p_sku: input.sku,
    p_quantity: input.quantity,
    p_cost: input.cost,
    p_price: input.price,
  });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  return {};
}

export type TransferLineInput = { variantId?: string; floatingVariantId?: string; sentQty: number };

// Covers both directions (floating -> branch, or a branch -> floating
// pull-back) since source/destination are just parameters to the RPC.
// Used from both /floating-inventory (owner) and the branch's own
// /inventory page (owner-only "Send to floating inventory") -- imported
// directly rather than duplicated as a thin per-page wrapper, since
// unlike the cash-transfer actions this doesn't need an extra
// caller-supplied shopId: the RPC already resolves everything from its
// own explicit source/destination parameters.
export async function createInventoryTransferAction(
  sourceType: "branch" | "floating",
  sourceShopId: string | null,
  destinationType: "branch" | "floating",
  destinationShopId: string | null,
  lines: TransferLineInput[],
  note: string | null,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can move inventory between branches" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_inventory_transfer", {
    p_source_type: sourceType,
    p_source_shop_id: sourceShopId,
    p_destination_type: destinationType,
    p_destination_shop_id: destinationShopId,
    p_lines: lines.map((l) => ({
      variant_id: l.variantId ?? null,
      floating_variant_id: l.floatingVariantId ?? null,
      sent_qty: l.sentQty,
    })),
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

// Recording a counted quantity per line is a plain RLS-gated write, not
// an RPC -- same reasoning stock_audit_lines.counted_qty is
// member-writable (recording a count isn't a trust decision). Saved
// per-line as the checklist is worked through, so it's resumable.
export async function saveTransferLineCountAction(
  lineId: string,
  receivedQty: number | null,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_transfer_lines")
    .update({ received_qty: receivedQty })
    .eq("id", lineId);
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

export async function receiveInventoryTransferAction(transferId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_inventory_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

export async function cancelInventoryTransferAction(transferId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_inventory_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}
