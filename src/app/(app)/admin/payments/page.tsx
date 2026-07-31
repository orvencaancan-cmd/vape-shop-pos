import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { approvePaymentAction, rejectPaymentAction } from "./actions";

export default async function AdminPaymentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("manual_payment_requests")
    .select("id, method, amount, reference_note, status, submitted_at, shops(id, name)")
    .order("submitted_at", { ascending: false })
    .limit(100);

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const reviewed = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-xs text-muted underline underline-offset-2 hover:text-ink">
        ← Platform admin
      </Link>
      <h1 className="heading mt-2 text-2xl">Manual payments</h1>
      <p className="mt-1 text-sm text-muted">
        Confirm the reference number against your GCash/Maya app, then approve or reject.
      </p>

      <h2 className="mt-6 text-sm font-medium text-muted">
        Pending {pending.length > 0 && `(${pending.length})`}
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing waiting on review.</p>
      ) : (
        <div className="stagger mt-2 flex flex-col gap-3">
          {pending.map((r) => {
            const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops;
            const boundApprove = approvePaymentAction.bind(null, r.id);
            const boundReject = rejectPaymentAction.bind(null, r.id);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-canvas-soft p-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{shop?.name ?? "Unknown shop"}</p>
                  <p className="text-xs text-muted">
                    {r.method === "gcash" ? "GCash" : "Maya"} · ₱{Number(r.amount).toFixed(2)} · ref{" "}
                    <span className="font-mono">{r.reference_note}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Submitted {new Date(r.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={boundApprove}>
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={boundReject}>
                    <button
                      type="submit"
                      className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-body transition-colors hover:text-ink"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium text-muted">Recently reviewed</h2>
      {reviewed.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing reviewed yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="py-1.5 pr-3">Shop</th>
                <th className="py-1.5 pr-3">Method</th>
                <th className="py-1.5 pr-3">Amount</th>
                <th className="py-1.5 pr-3">Reference</th>
                <th className="py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((r) => {
                const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops;
                return (
                  <tr key={r.id} className="border-b border-hairline">
                    <td className="py-1.5 pr-3 text-body">{shop?.name ?? "Unknown shop"}</td>
                    <td className="py-1.5 pr-3 text-muted">
                      {r.method === "gcash" ? "GCash" : "Maya"}
                    </td>
                    <td className="py-1.5 pr-3 text-muted">₱{Number(r.amount).toFixed(2)}</td>
                    <td className="py-1.5 pr-3 font-mono text-muted">{r.reference_note}</td>
                    <td className="py-1.5 text-muted">
                      {r.status === "approved" ? (
                        <span className="text-success">Approved</span>
                      ) : (
                        <span className="text-error">Rejected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
