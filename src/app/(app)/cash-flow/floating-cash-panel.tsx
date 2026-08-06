"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import {
  recordFloatingCashMovementAction,
  receiveCashTransferAction,
  cancelCashTransferAction,
} from "./actions";

type Movement = {
  id: string;
  direction: "in" | "out";
  amount: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  counterpartyName: string | null;
};

type PendingTransfer = {
  id: string;
  sourceType: "branch" | "floating";
  sourceShopId: string | null;
  sourceShopName: string | null;
  destinationType: "branch" | "floating";
  destinationShopId: string | null;
  destinationShopName: string | null;
  amount: number;
  note: string | null;
  createdAt: string;
  initiatedByName: string | null;
};

export function FloatingCashPanel({
  balance,
  movements,
  branches,
  incomingTransfers,
  outgoingTransfers,
}: {
  balance: number;
  movements: Movement[];
  branches: { shopId: string; shopName: string }[];
  incomingTransfers: PendingTransfer[];
  outgoingTransfers: PendingTransfer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState<"in" | "out" | null>(null);
  const [amount, setAmount] = useState("");
  const [counterpartyShopId, setCounterpartyShopId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [transferActionId, setTransferActionId] = useState<string | null>(null);

  function resetForm() {
    setShowForm(null);
    setAmount("");
    setCounterpartyShopId("");
    setNote("");
  }

  function receiveTransfer(transfer: PendingTransfer) {
    if (
      !confirm(`Receive ${formatCurrency(transfer.amount)} from ${transfer.sourceShopName}? This can't be undone.`)
    ) {
      return;
    }
    setMessage(null);
    setTransferActionId(transfer.id);
    startTransition(async () => {
      const result = await receiveCashTransferAction(transfer.id);
      setTransferActionId(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  function cancelTransfer(transferId: string) {
    setMessage(null);
    setTransferActionId(transferId);
    startTransition(async () => {
      const result = await cancelCashTransferAction(transferId);
      setTransferActionId(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  function submit() {
    const direction = showForm;
    if (!direction) return;
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: "error", text: "Enter an amount" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await recordFloatingCashMovementAction(
        direction,
        amountNum,
        counterpartyShopId || null,
        note.trim() || null,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Floating cash</h2>
        <span className="text-lg font-semibold text-ink">{formatCurrency(balance)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        A shared reserve across your branches, separate from any one register.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm("in");
          }}
          className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm("out");
          }}
          className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
        >
          Withdraw
        </button>
      </div>

      {incomingTransfers.length > 0 && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h3 className="text-xs font-medium text-ink">Incoming cash</h3>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {incomingTransfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-ink">{formatCurrency(t.amount)}</span>
                  <span className="ml-2 text-muted">from {t.sourceShopName}</span>
                  {t.note && <span className="ml-2 text-muted">{t.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => receiveTransfer(t)}
                  disabled={pending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
                >
                  {pending && transferActionId === t.id ? "Receiving…" : "Receive"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoingTransfers.length > 0 && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h3 className="text-xs font-medium text-ink">Sent, awaiting receipt</h3>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {outgoingTransfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-ink">{formatCurrency(t.amount)}</span>
                  <span className="ml-2 text-muted">to {t.destinationShopName}</span>
                  {t.note && <span className="ml-2 text-muted">{t.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => cancelTransfer(t.id)}
                  disabled={pending}
                  className="text-muted underline underline-offset-2 disabled:opacity-50"
                >
                  {pending && transferActionId === t.id ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h3 className="text-xs font-medium text-ink">
            {showForm === "in" ? "Deposit" : "Withdraw"}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            {showForm === "out" && branches.length > 0 && (
              <select
                value={counterpartyShopId}
                onChange={(e) => setCounterpartyShopId(e.target.value)}
                className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value="">Not going to a branch</option>
                {branches.map((b) => (
                  <option key={b.shopId} value={b.shopId}>
                    {b.shopName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            type="text"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-muted underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mt-2 text-xs ${message.type === "error" ? "text-error" : "text-success"}`}>
          {message.text}
        </p>
      )}

      {movements.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-hairline border-t border-hairline">
          {movements.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span className="min-w-0 truncate">
                <span className={m.direction === "in" ? "text-success" : "text-error"}>
                  {m.direction === "in" ? "+" : "−"}
                  {formatCurrency(m.amount)}
                </span>
                {m.counterpartyName && (
                  <span className="ml-2 text-muted">
                    {m.direction === "out" ? "to" : "from"} {m.counterpartyName}
                  </span>
                )}
                {m.note && <span className="ml-2 text-muted">{m.note}</span>}
                {m.createdByName && <span className="ml-2 text-muted">{m.createdByName}</span>}
              </span>
              <span className="shrink-0 text-muted">{new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
