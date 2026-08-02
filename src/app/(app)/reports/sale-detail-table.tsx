"use client";

import { Fragment, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import type { SaleDetail } from "@/lib/reports/compute";
import { Empty } from "./report-ui";

const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", gcash: "GCash" };

export function SaleDetailTable({ sales }: { sales: SaleDetail[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableOpen, setTableOpen] = useState(false);

  if (sales.length === 0) return <Empty />;

  function toggle(saleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setTableOpen((v) => !v)}
        aria-expanded={tableOpen}
        className="flex w-full items-center gap-1.5 rounded-lg py-1 text-sm text-body hover:text-ink"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${tableOpen ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
        {sales.length} sale{sales.length === 1 ? "" : "s"} — {tableOpen ? "hide" : "show"} details
      </button>
      {tableOpen && (
        <div className="mt-2 w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-1.5 pr-3 text-left font-normal">Time</th>
                <th className="py-1.5 pr-3 text-left font-normal">Item</th>
                <th className="py-1.5 pr-3 text-right font-normal">Qty</th>
                <th className="py-1.5 pr-3 text-right font-normal">Price</th>
                <th className="py-1.5 pr-3 text-right font-normal">Sale total</th>
                <th className="py-1.5 pr-3 text-left font-normal">Notes</th>
                <th className="py-1.5 text-right font-normal">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const isExpanded = expanded.has(s.saleId);
                return (
                  <Fragment key={s.saleId}>
                    <tr
                      className="cursor-pointer border-b border-hairline last:border-0 hover:bg-canvas-strong"
                      onClick={() => toggle(s.saleId)}
                      aria-expanded={isExpanded}
                    >
                      <td className="py-1.5 pr-3 text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                          {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-ink">
                        {s.lines.length} item{s.lines.length === 1 ? "" : "s"}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-ink"></td>
                      <td className="py-1.5 pr-3 text-right text-ink"></td>
                      <td className="py-1.5 pr-3 text-right text-ink">{formatCurrency(s.total)}</td>
                      <td className="py-1.5 pr-3 text-warning">{s.note}</td>
                      <td className="py-1.5 text-right text-body">
                        {PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}
                      </td>
                    </tr>
                    {isExpanded &&
                      s.lines.map((line, i) => (
                        <tr key={i} className="border-b border-hairline bg-canvas last:border-0">
                          <td className="py-1.5 pr-3"></td>
                          <td className="py-1.5 pr-3 pl-5 text-muted">
                            {line.brand ? `${line.brand} — ` : ""}
                            {line.productName} — {line.label}
                          </td>
                          <td className="py-1.5 pr-3 text-right text-muted">{line.quantity}</td>
                          <td className="py-1.5 pr-3 text-right text-muted">
                            {formatCurrency(line.lineTotal)}
                          </td>
                          <td className="py-1.5 pr-3"></td>
                          <td className="py-1.5 pr-3"></td>
                          <td className="py-1.5"></td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
