"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type ActionState = { error?: string };

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  note: z.string().optional(),
});

export async function createExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    shop_id: profile.shopId,
    amount: parsed.data.amount,
    category: parsed.data.category,
    note: parsed.data.note || null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/reports");
  return {};
}

export async function deleteExpenseAction(expenseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", expenseId).eq("shop_id", profile.shopId);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}
