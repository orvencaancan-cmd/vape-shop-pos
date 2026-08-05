import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/currency";
import { ExpenseForm } from "./expense-form";
import { deleteExpenseAction } from "./actions";
import { ActionButton } from "@/components/action-button";

export default async function ExpensesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, amount, category, note, created_at, profiles(display_name)")
    .eq("shop_id", profile.shopId)
    .order("created_at", { ascending: false });

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Expenses</h1>

      <div className="stagger mt-6 flex flex-col gap-3">
        {(expenses ?? []).map((e) => {
          const recorder = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
          const boundDelete = deleteExpenseAction.bind(null, e.id);
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {e.category}
                  {e.note ? ` — ${e.note}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {new Date(e.created_at).toLocaleDateString()}
                  {recorder?.display_name ? ` · ${recorder.display_name}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {formatCurrency(Number(e.amount))}
              </span>
              {profile.role === "owner" && (
                <ActionButton action={boundDelete} className="shrink-0 text-xs text-error underline">
                  Delete
                </ActionButton>
              )}
            </div>
          );
        })}
        {(expenses ?? []).length === 0 && (
          <p className="text-sm text-muted">No expenses recorded yet.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Add an expense</h2>
      <div className="mt-2">
        <ExpenseForm />
      </div>
    </main>
  );
}
