"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startOrResumeAuditAction,
  saveCountAction,
  confirmAuditAction,
  discardAuditAction,
  removeCompletedAuditAction,
} from "./actions";
import { formatCurrency } from "@/lib/currency";

export type AuditVariant = {
  id: string;
  productName: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  label: string;
  stockQty: number;
  cost: number;
};

export type AuditDiscrepancy = {
  item: string;
  systemQty: number;
  countedQty: number;
  diff: number;
  valueImpact: number;
};

export type AuditHistoryEntry = {
  id: string;
  startedAt: string;
  completedAt: string;
  completedByName: string | null;
  itemsCounted: number;
  discrepancies: AuditDiscrepancy[];
};

type BrandGroup = { brandKey: string; brandLabel: string; variants: AuditVariant[] };

const NO_BRAND = "__no_brand__";

function buildDiscrepancies(
  variants: AuditVariant[],
  counts: Map<string, number>,
): AuditDiscrepancy[] {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const rows: AuditDiscrepancy[] = [];
  for (const [variantId, countedQty] of counts) {
    const v = byId.get(variantId);
    if (!v) continue;
    if (countedQty === v.stockQty) continue;
    const diff = countedQty - v.stockQty;
    rows.push({
      item: `${v.brand ? `${v.brand} — ` : ""}${v.productName} — ${v.label}`,
      systemQty: v.stockQty,
      countedQty,
      diff,
      valueImpact: diff * v.cost,
    });
  }
  return rows;
}

export function AuditScreen({
  variants,
  openAuditId,
  existingCounts,
  history,
  isOwner,
}: {
  variants: AuditVariant[];
  openAuditId: string | null;
  existingCounts: { variantId: string; countedQty: number }[];
  history: AuditHistoryEntry[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [auditId, setAuditId] = useState(openAuditId);
  const [counts, setCounts] = useState<Map<string, number>>(
    () => new Map(existingCounts.map((c) => [c.variantId, c.countedQty])),
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [justCompleted, setJustCompleted] = useState<AuditDiscrepancy[] | null>(null);

  const hasActiveFilter = search.trim() !== "" || category !== "all";

  const toggleBrand = (brandKey: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandKey)) next.delete(brandKey);
      else next.add(brandKey);
      return next;
    });
  };

  const filtered = variants.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return v.productName.toLowerCase().includes(q) || v.label.toLowerCase().includes(q);
  });

  const brandGroupMap = new Map<string, BrandGroup>();
  for (const v of filtered) {
    const brandKey = v.brand ?? NO_BRAND;
    if (!brandGroupMap.has(brandKey)) {
      brandGroupMap.set(brandKey, { brandKey, brandLabel: v.brand ?? "No brand", variants: [] });
    }
    brandGroupMap.get(brandKey)!.variants.push(v);
  }
  const brandGroups = [...brandGroupMap.values()];
  brandGroups.sort((a, b) => {
    if (a.brandKey === NO_BRAND) return 1;
    if (b.brandKey === NO_BRAND) return -1;
    return a.brandLabel.localeCompare(b.brandLabel);
  });

  const discrepancies = useMemo(() => buildDiscrepancies(variants, counts), [variants, counts]);

  function handleStart() {
    setMessage(null);
    setJustCompleted(null);
    startTransition(async () => {
      const result = await startOrResumeAuditAction();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setAuditId(result.auditId!);
      }
    });
  }

  function handleCountChange(variantId: string, systemQty: number, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    setCounts((prev) => {
      const next = new Map(prev);
      if (value === null || Number.isNaN(value)) next.delete(variantId);
      else next.set(variantId, value);
      return next;
    });
    if (!auditId) return;
    saveCountAction(auditId, variantId, systemQty, value === null || Number.isNaN(value) ? null : value);
  }

  function handleConfirm() {
    if (!auditId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await confirmAuditAction(auditId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setJustCompleted(discrepancies);
        setAuditId(null);
        setCounts(new Map());
        router.refresh();
      }
    });
  }

  function handleDiscard() {
    if (!auditId) return;
    if (!confirm("Discard this audit? Everything counted so far will be lost.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await discardAuditAction(auditId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setAuditId(null);
        setCounts(new Map());
        router.refresh();
      }
    });
  }

  if (justCompleted) {
    return (
      <div className="mt-6">
        <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
          <h2 className="text-sm font-medium text-ink">Audit completed</h2>
          {justCompleted.length === 0 ? (
            <p className="mt-2 text-sm text-success">No discrepancies found.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                {justCompleted.length} discrepanc{justCompleted.length === 1 ? "y" : "ies"} found
                and applied to stock.
              </p>
              <DiscrepancyTable rows={justCompleted} />
            </>
          )}
          <button
            onClick={() => setJustCompleted(null)}
            className="mt-3 rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Done
          </button>
        </div>
        <HistorySection history={history} isOwner={isOwner} />
      </div>
    );
  }

  if (!auditId) {
    return (
      <div className="mt-6">
        <button
          onClick={handleStart}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start audit"}
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.type === "error" ? "text-error" : "text-success"}`}>
            {message.text}
          </p>
        )}
        <HistorySection history={history} isOwner={isOwner} />
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {(["all", "ejuice", "accessory"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                category === c
                  ? "bg-primary text-on-primary"
                  : "bg-canvas-strong text-body hover:text-ink"
              }`}
            >
              {c === "all" ? "All" : c === "ejuice" ? "E-juice" : "Accessories"}
            </button>
          ))}
        </div>

        <div className="stagger mt-4 flex flex-col gap-4">
          {brandGroups.map((group) => {
            const isExpanded = hasActiveFilter || expandedBrands.has(group.brandKey);
            return (
              <section
                key={group.brandKey}
                className="rounded-xl border border-hairline bg-canvas-soft px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => toggleBrand(group.brandKey)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  <h2 className="heading text-base">{group.brandLabel}</h2>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className={`h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="animate-fade-in-up mt-3 flex flex-col divide-y divide-hairline">
                    {group.variants.map((v) => {
                      const counted = counts.get(v.id);
                      const mismatch = counted !== undefined && counted !== v.stockQty;
                      return (
                        <div
                          key={v.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">{v.productName}</p>
                            <p className="text-xs text-muted">{v.label}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted">System: {v.stockQty}</span>
                            <input
                              type="number"
                              placeholder="Count"
                              defaultValue={counted ?? ""}
                              onBlur={(e) => handleCountChange(v.id, v.stockQty, e.target.value)}
                              className={`w-24 rounded-lg border px-2 py-1.5 text-sm focus:outline-none ${
                                mismatch
                                  ? "border-warning bg-warning/10 text-ink"
                                  : "border-hairline bg-canvas text-ink focus:border-primary"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          {brandGroups.length === 0 && <p className="text-sm text-muted">No products match.</p>}
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-hairline bg-canvas-soft p-4">
        <h2 className="text-sm font-medium text-muted">This audit</h2>
        <p className="mt-2 text-sm text-ink">{counts.size} item{counts.size === 1 ? "" : "s"} counted</p>
        <p className="text-sm text-ink">
          {discrepancies.length} discrepanc{discrepancies.length === 1 ? "y" : "ies"}
        </p>

        {discrepancies.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 border-t border-hairline pt-3">
            {discrepancies.map((d) => (
              <div key={d.item} className="text-xs text-body">
                <span className="text-ink">{d.item}</span>
                <span className={`ml-1 ${d.diff < 0 ? "text-error" : "text-success"}`}>
                  {d.diff > 0 ? `+${d.diff}` : d.diff}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-hairline pt-3">
          <button
            onClick={handleConfirm}
            disabled={pending || counts.size === 0}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {pending ? "Confirming…" : "Confirm audit"}
          </button>
          <button
            onClick={handleDiscard}
            disabled={pending}
            className="w-full rounded-lg bg-canvas-strong px-4 py-2 text-sm text-body transition-colors hover:text-ink disabled:opacity-50"
          >
            Discard audit
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-sm ${message.type === "error" ? "text-error" : "text-success"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function DiscrepancyTable({ rows }: { rows: AuditDiscrepancy[] }) {
  return (
    <div className="mt-2 w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-muted">
            <th className="py-1.5 pr-3 text-left font-normal">Item</th>
            <th className="py-1.5 pr-3 text-right font-normal">System</th>
            <th className="py-1.5 pr-3 text-right font-normal">Counted</th>
            <th className="py-1.5 pr-3 text-right font-normal">Diff</th>
            <th className="py-1.5 text-right font-normal">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-3 text-ink">{r.item}</td>
              <td className="py-1.5 pr-3 text-right text-muted">{r.systemQty}</td>
              <td className="py-1.5 pr-3 text-right text-ink">{r.countedQty}</td>
              <td className={`py-1.5 pr-3 text-right ${r.diff < 0 ? "text-error" : "text-success"}`}>
                {r.diff > 0 ? `+${r.diff}` : r.diff}
              </td>
              <td className="py-1.5 text-right text-body">{formatCurrency(r.valueImpact)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistorySection({
  history,
  isOwner,
}: {
  history: AuditHistoryEntry[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRemove(auditId: string) {
    if (!confirm("Remove this audit from history? This only deletes the record — it won't undo any stock changes it already made.")) {
      return;
    }
    setRemovingId(auditId);
    startTransition(async () => {
      const result = await removeCompletedAuditAction(auditId);
      setRemovingId(null);
      if (!result.error) router.refresh();
    });
  }

  if (history.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted">Audit history</h2>
        <p className="mt-2 text-sm text-muted">No completed audits yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-muted">Audit history</h2>
      <div className="mt-2 flex flex-col divide-y divide-hairline rounded-xl border border-hairline bg-canvas-soft">
        {history.map((a) => {
          const isOpen = openId === a.id;
          const totalValue = a.discrepancies.reduce((sum, d) => sum + d.valueImpact, 0);
          return (
            <div key={a.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="flex flex-1 flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div>
                    <span className="text-sm text-ink">{new Date(a.completedAt).toLocaleString()}</span>
                    {a.completedByName && (
                      <span className="ml-2 text-xs text-muted">{a.completedByName}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    {a.itemsCounted} counted ·{" "}
                    {a.discrepancies.length === 0
                      ? "no discrepancies"
                      : `${a.discrepancies.length} discrepanc${a.discrepancies.length === 1 ? "y" : "ies"} (${formatCurrency(totalValue)})`}
                  </span>
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(a.id)}
                    disabled={pending && removingId === a.id}
                    className="shrink-0 text-xs text-error underline underline-offset-2 disabled:opacity-50"
                  >
                    {pending && removingId === a.id ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
              {isOpen && a.discrepancies.length > 0 && <DiscrepancyTable rows={a.discrepancies} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
