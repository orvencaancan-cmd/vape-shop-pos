"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type CashActionResult = { error?: string };

// Relocated from branches/actions.ts -- this is cash management, not branch
// lifecycle management, and this page is now its natural home.
//
// A Withdraw sent to a specific branch no longer debits the pool directly
// -- it creates a pending transfer (create_cash_transfer) that stays
// counted in the pool until that branch receives it. Deposit stays
// immediate always: the owner is both source and destination of trust
// there (cash already in hand, self-attested), so there's no in-app
// counterparty to receive it from.
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

  if (direction === "out" && counterpartyShopId) {
    const { error } = await supabase.rpc("create_cash_transfer", {
      p_source_type: "floating",
      p_source_shop_id: null,
      p_destination_type: "branch",
      p_destination_shop_id: counterpartyShopId,
      p_amount: amount,
      p_note: note,
    });
    if (error) return { error: error.message };
    revalidatePath("/cash-flow");
    revalidatePath("/dashboard");
    return {};
  }

  const { error } = await supabase.rpc("record_floating_cash_movement", {
    p_direction: direction,
    p_amount: amount,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  return {};
}

export async function receiveCashTransferAction(transferId: string): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_cash_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/sell");
  return {};
}

export async function cancelCashTransferAction(transferId: string): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cash_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/cash-flow");
  revalidatePath("/sell");
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

// Same split as the Sell screen's recordCashMovementAction: a transfer-type
// Cash Out creates a pending transfer instead of debiting this branch
// directly, and Cash In is 'general' only -- receiving happens through
// receiveCashTransferAction.
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

  if (movementType !== "general") {
    if (direction !== "out") {
      return { error: "Receive incoming cash from the Incoming cash section instead" };
    }
    const { error } = await supabase.rpc("create_cash_transfer", {
      p_source_type: "branch",
      p_source_shop_id: shopId,
      p_destination_type: movementType === "floating_pool" ? "floating" : "branch",
      p_destination_shop_id: movementType === "branch_transfer" ? counterpartyShopId : null,
      p_amount: amount,
      p_note: note,
    });
    if (error) return { error: error.message };
    revalidatePath("/cash-flow");
    revalidatePath("/dashboard");
    return {};
  }

  const { error } = await supabase.rpc("record_cash_movement", {
    p_shop_id: shopId,
    p_direction: direction,
    p_amount: amount,
    p_movement_type: "general",
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
