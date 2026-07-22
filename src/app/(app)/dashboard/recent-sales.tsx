"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { voidSaleAction } from "@/app/(app)/sell/actions";
import { formatCurrency } from "@/lib/currency";

export type DashboardSale = {
  id: string;
  total: number;
  createdAt: string;
  voidedAt: string | null;
};

export function DashboardRecentSales({ sales }: { sales: DashboardSale[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function voidSale(saleId: string, total: number) {
    if (!confirm(`Void this ${formatCurrency(total)} sale? This restores the stock quantity.`)) {
      return;
    }
    setError(null);
    setVoidingId(saleId);
    startTransition(async () => {
      const result = await voidSaleAction(saleId);
      setVoidingId(null);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (sales.length === 0) {
    return <p className="mt-2 text-sm text-muted">No sales yet.</p>;
  }

  return (
    <>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {sales.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2">
            <span className={s.voidedAt ? "text-muted line-through" : "text-muted"}>
              {new Date(s.createdAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <span className={s.voidedAt ? "text-muted line-through" : "text-ink"}>
                {formatCurrency(s.total)}
              </span>
              {s.voidedAt ? (
                <span className="rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-muted">
                  Voided
                </span>
              ) : (
                <button
                  onClick={() => voidSale(s.id, s.total)}
                  disabled={pending && voidingId === s.id}
                  className="text-xs text-error underline underline-offset-2 disabled:opacity-50"
                >
                  {pending && voidingId === s.id ? "Voiding…" : "Void"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </>
  );
}
