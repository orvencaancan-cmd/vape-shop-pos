"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type StartAuditResult = { error?: string; auditId?: string };

export async function startOrResumeAuditAction(): Promise<StartAuditResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("stock_audits")
    .select("id")
    .eq("shop_id", profile.shopId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { auditId: existing.id as string };

  const { data: created, error } = await supabase
    .from("stock_audits")
    .insert({ shop_id: profile.shopId, started_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/audit");
  return { auditId: created.id as string };
}

export type SaveCountResult = { error?: string };

export async function saveCountAction(
  auditId: string,
  variantId: string,
  systemQty: number,
  countedQty: number | null,
): Promise<SaveCountResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  if (countedQty === null) {
    const { error } = await supabase
      .from("stock_audit_lines")
      .delete()
      .eq("audit_id", auditId)
      .eq("variant_id", variantId)
      .eq("shop_id", profile.shopId);
    if (error) return { error: error.message };
    return {};
  }

  const { error } = await supabase.from("stock_audit_lines").upsert(
    {
      shop_id: profile.shopId,
      audit_id: auditId,
      variant_id: variantId,
      system_qty: systemQty,
      counted_qty: countedQty,
    },
    { onConflict: "audit_id,variant_id" },
  );
  if (error) return { error: error.message };

  return {};
}

export type DiscardAuditResult = { error?: string };

export async function discardAuditAction(auditId: string): Promise<DiscardAuditResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_audits")
    .delete()
    .eq("id", auditId)
    .eq("shop_id", profile.shopId)
    .is("completed_at", null);
  if (error) return { error: error.message };

  revalidatePath("/audit");
  return {};
}

export type ConfirmAuditResult = { error?: string };

export async function confirmAuditAction(auditId: string): Promise<ConfirmAuditResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_stock_audit", {
    p_shop_id: profile.shopId,
    p_audit_id: auditId,
  });
  if (error) return { error: error.message };

  revalidatePath("/audit");
  revalidatePath("/inventory");
  revalidatePath("/sell");
  revalidatePath("/dashboard");
  return {};
}
