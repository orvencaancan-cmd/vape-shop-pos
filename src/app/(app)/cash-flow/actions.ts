"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type CashActionResult = { error?: string };

// Relocated from branches/actions.ts -- this is cash management, not branch
// lifecycle management, and this page is now its natural home.
export async function recordFloatingCashMovementAction(
  direction: "in" | "out",
  amount: number,
  counterpartyShopId: string | null,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage the floating cash pool" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_floating_cash_movement", {
    p_direction: direction,
    p_amount: amount,
    p_counterparty_shop_id: counterpartyShopId,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  return {};
}

// The three actions below act on an explicit shopId rather than the
// caller's implicit "active" shop -- unlike the Sell screen's cash
// actions, this page lets an owner manage any of their branches without
// switching into it first. The RPCs themselves already take p_shop_id and
// verify is_member_of/is_owner against it directly (see
// supabase/migrations/0043_cash_flow.sql), so no schema change is needed;
// only the ownership check below (mirroring branches/actions.ts's existing
// archiveShopAction pattern) guards which shopId a caller may pass in.

export async function openCashSessionForBranchAction(
  shopId: string,
  openingCash: number,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) {
    return { error: "You must own this branch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_cash_session", {
    p_shop_id: shopId,
    p_opening_cash: openingCash,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  return {};
}

export async function recordCashMovementForBranchAction(
  shopId: string,
  direction: "in" | "out",
  amount: number,
  movementType: "general" | "branch_transfer" | "floating_pool",
  counterpartyShopId: string | null,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) {
    return { error: "You must own this branch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_cash_movement", {
    p_shop_id: shopId,
    p_direction: direction,
    p_amount: amount,
    p_movement_type: movementType,
    p_counterparty_shop_id: counterpartyShopId,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  return {};
}

export async function closeCashSessionForBranchAction(
  shopId: string,
  closingCash: number,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) {
    return { error: "You must own this branch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_cash_session", {
    p_shop_id: shopId,
    p_closing_cash: closingCash,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  return {};
}
