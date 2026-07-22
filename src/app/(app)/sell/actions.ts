"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaleResult = { error?: string; saleId?: string };

export async function recordSaleAction(
  cart: { variantId: string; quantity: number }[],
): Promise<SaleResult> {
  if (cart.length === 0) {
    return { error: "Cart is empty" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_sale", {
    items: cart.map((item) => ({
      variant_id: item.variantId,
      quantity: item.quantity,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  return { saleId: data as string };
}

export type VoidResult = { error?: string };

export async function voidSaleAction(saleId: string): Promise<VoidResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {};
}
