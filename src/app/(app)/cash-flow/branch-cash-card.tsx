"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { Stat } from "@/components/ui/stat";
import {
  openCashSessionForBranchAction,
  recordCashMovementForBranchAction,
  closeCashSessionForBranchAction,
  receiveCashTransferAction,
  cancelCashTransferAction,
} from "./actions";

type CashSession = {
  id: string;
  openingCash: number;
  openedAt: string;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  closedAt: string | null;
  status: "open" | "closed";
} | null;

type CashMovement = {
  id: string;
  direction: "in" | "out";
  movementType: "general" | "branch_transfer" | "floating_pool";
  amount: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  counterpartyName: string | null;
};

const MOVEMENT_TYPE_LABELS: Record<CashMovement["movementType"], string> = {
  general: "Cash",
  branch_transfer: "Branch transfer",
  floating_pool: "Floating pool",
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

export function BranchCashCard({
  shopId,
  shopName,
  session,
  movements,
  cashSalesToday,
  cashInDrawer,
  otherBranches,
  incomingTransfers,
  outgoingTransfers,
}: {
  shopId: string;
  shopName: string;
  session: CashSession;
  movements: CashMovement[];
  cashSalesToday: number;
  cashInDrawer: number;
  otherBranches: { shopId: string; shopName: string }[];
  incomingTransfers: PendingTransfer[];
  outgoingTransfers: PendingTransfer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [transferActionId, setTransferActionId] = useState<string | null>(null);

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [openNoteInput, setOpenNoteInput] = useState("");

  const [showCashMovementForm, setShowCashMovementForm] = useState<"in" | "out" | null>(null);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementType, setMovementType] = useState<CashMovement["movementType"]>("general");
  const [movementCounterparty, setMovementCounterparty] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState("");
  const [closeNoteInput, setCloseNoteInput] = useState("");

  function resetMovementForm() {
    setShowCashMovementForm(null);
    setMovementAmount("");
    setMovementType("general");
    setMovementCounterparty("");
    setMovementNote("");
  }

  function openRegister() {
    const amount = Number(openingCashInput);
    if (!openingCashInput.trim() || Number.isNaN(amount) || amount < 0) {
      setMessage({ type: "error", text: "Enter a starting cash amount" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await openCashSessionForBranchAction(shopId, amount, openNoteInput.trim() || null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setShowOpenForm(false);
      setOpeningCashInput("");
      setOpenNoteInput("");
      router.refresh();
    });
  }

  function submitCashMovement() {
    const direction = showCashMovementForm;
    if (!direction) return;
    const amount = Number(movementAmount);
    if (!movementAmount.trim() || Number.isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Enter an amount" });
      return;
    }
    if (movementType === "branch_transfer" && !movementCounterparty) {
      setMessage({ type: "error", text: "Pick which branch" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await recordCashMovementForBranchAction(
        shopId,
        direction,
        amount,
        movementType,
        movementType === "branch_transfer" ? movementCounterparty : null,
        movementNote.trim() || null,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      resetMovementForm();
      router.refresh();
    });
  }

  function receiveTransfer(transferId: string) {
    setMessage(null);
    setTransferActionId(transferId);
    startTransition(async () => {
      const result = await receiveCashTransferAction(transferId);
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

  function closeRegister() {
    const amount = Number(closingCashInput);
    if (!closingCashInput.trim() || Number.isNaN(amount) || amount < 0) {
      setMessage({ type: "error", text: "Enter the counted cash amount" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await closeCashSessionForBranchAction(shopId, amount, closeNoteInput.trim() || null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setShowCloseForm(false);
      setClosingCashInput("");
      setCloseNoteInput("");
      router.refresh();
    });
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{shopName}</h3>
          <span className="text-xs text-muted">Not opened today</span>
        </div>

        {!showOpenForm ? (
          <button
            type="button"
            onClick={() => setShowOpenForm(true)}
            className="mt-3 rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Open register
          </button>
        ) : (
          <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Starting cash"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={openNoteInput}
              onChange={(e) => setOpenNoteInput(e.target.value)}
              className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openRegister}
                disabled={pending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
              >
                {pending ? "Opening…" : "Open register"}
              </button>
              <button
                type="button"
                onClick={() => setShowOpenForm(false)}
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
      </div>
    );
  }

  if (session.status === "closed") {
    return (
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{shopName}</h3>
          <span className="text-xs text-muted">Closed for today</span>
        </div>
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Starting cash</span>
            <span className="text-ink">{formatCurrency(session.openingCash)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Expected cash</span>
            <span className="text-ink">{formatCurrency(session.expectedCash ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Counted cash</span>
            <span className="text-ink">{formatCurrency(session.closingCash ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-1.5 font-medium">
            <span className="text-body">Variance</span>
            <span
              className={
                (session.variance ?? 0) === 0
                  ? "text-ink"
                  : (session.variance ?? 0) > 0
                    ? "text-success"
                    : "text-error"
              }
            >
              {formatCurrency(session.variance ?? 0)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const cashInSum = movements.filter((m) => m.direction === "in").reduce((sum, m) => sum + m.amount, 0);
  const cashOutSum = movements.filter((m) => m.direction === "out").reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{shopName}</h3>
          <p className="text-xs text-muted">
            Open since{" "}
            {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · started with "}
            {formatCurrency(session.openingCash)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetMovementForm();
              setShowCloseForm(false);
              setShowCashMovementForm("in");
            }}
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Cash In
          </button>
          <button
            type="button"
            onClick={() => {
              resetMovementForm();
              setShowCloseForm(false);
              setShowCashMovementForm("out");
            }}
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Cash Out
          </button>
          <button
            type="button"
            onClick={() => {
              resetMovementForm();
              setShowCloseForm(true);
            }}
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Close register
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 border-t border-hairline pt-3">
        <Stat label="Starting cash" value={formatCurrency(session.openingCash)} />
        <Stat label="Cash sales" value={formatCurrency(cashSalesToday)} />
        <Stat label="Cash in" value={formatCurrency(cashInSum)} />
        <Stat label="Cash out" value={formatCurrency(cashOutSum)} />
        <Stat label="Cash in drawer" value={formatCurrency(cashInDrawer)} />
      </div>

      {incomingTransfers.length > 0 && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h4 className="text-xs font-medium text-ink">Incoming cash</h4>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {incomingTransfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-ink">{formatCurrency(t.amount)}</span>
                  <span className="ml-2 text-muted">
                    from {t.sourceType === "floating" ? "Floating Cash" : t.sourceShopName}
                  </span>
                  {t.note && <span className="ml-2 text-muted">{t.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => receiveTransfer(t.id)}
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
          <h4 className="text-xs font-medium text-ink">Sent, awaiting receipt</h4>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {outgoingTransfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-ink">{formatCurrency(t.amount)}</span>
                  <span className="ml-2 text-muted">
                    to {t.destinationType === "floating" ? "Floating Cash" : t.destinationShopName}
                  </span>
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

      {showCashMovementForm && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h4 className="text-xs font-medium text-ink">
            {showCashMovementForm === "in" ? "Cash In" : "Cash Out"}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Amount"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              className="w-32 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            {showCashMovementForm === "out" && (
              <select
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value as CashMovement["movementType"]);
                  setMovementCounterparty("");
                }}
                className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value="general">General</option>
                <option value="branch_transfer">Send to another branch</option>
                <option value="floating_pool">Send to floating cash pool</option>
              </select>
            )}
            {showCashMovementForm === "out" && movementType === "branch_transfer" && (
              <select
                value={movementCounterparty}
                onChange={(e) => setMovementCounterparty(e.target.value)}
                className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value="">Which branch?</option>
                {otherBranches.map((b) => (
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
            value={movementNote}
            onChange={(e) => setMovementNote(e.target.value)}
            className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submitCashMovement}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={resetMovementForm}
              className="text-xs text-muted underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCloseForm && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <h4 className="text-xs font-medium text-ink">Close register</h4>
          <p className="mt-1 text-xs text-muted">Count the cash in the drawer and enter it below.</p>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Counted cash"
            value={closingCashInput}
            onChange={(e) => setClosingCashInput(e.target.value)}
            className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={closeNoteInput}
            onChange={(e) => setCloseNoteInput(e.target.value)}
            className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={closeRegister}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {pending ? "Closing…" : "Close register"}
            </button>
            <button
              type="button"
              onClick={() => setShowCloseForm(false)}
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
                <span className="ml-2 rounded-full bg-canvas-strong px-2 py-0.5 text-muted">
                  {MOVEMENT_TYPE_LABELS[m.movementType]}
                </span>
                {m.counterpartyName && (
                  <span className="ml-2 text-muted">
                    {m.direction === "out" ? "to" : "from"} {m.counterpartyName}
                  </span>
                )}
                {m.note && <span className="ml-2 text-muted">{m.note}</span>}
                {m.createdByName && <span className="ml-2 text-muted">{m.createdByName}</span>}
              </span>
              <span className="shrink-0 text-muted">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
