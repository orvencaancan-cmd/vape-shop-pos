"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type SaleResult = { error?: string; saleId?: string };

export async function recordSaleAction(
  cart: { variantId: string; quantity: number }[],
  paymentMethod: "cash" | "gcash",
  discountAmount: number,
  discountReason: string | null,
): Promise<SaleResult> {
  if (cart.length === 0) {
    return { error: "Cart is empty" };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_sale", {
    p_shop_id: profile.shopId,
    items: cart.map((item) => ({
      variant_id: item.variantId,
      quantity: item.quantity,
    })),
    p_payment_method: paymentMethod,
    p_discount_amount: discountAmount,
    p_discount_reason: discountReason,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  return { saleId: data as string };
}

export type VoidResult = { error?: string };

export async function voidSaleAction(saleId: string): Promise<VoidResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", {
    p_shop_id: profile.shopId,
    p_sale_id: saleId,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {};
}
