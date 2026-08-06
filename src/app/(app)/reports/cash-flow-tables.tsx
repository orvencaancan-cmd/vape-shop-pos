import { formatCurrency } from "@/lib/currency";
import type { CashSessionRow, CashMovementRow } from "@/lib/reports/compute";
import { Empty } from "./report-ui";

const MOVEMENT_TYPE_LABELS: Record<CashMovementRow["movementType"], string> = {
  general: "Cash",
  branch_transfer: "Branch transfer",
  floating_pool: "Floating pool",
};

export function CashSessionsTable({
  sessions,
  showBranch = false,
}: {
  sessions: CashSessionRow[];
  showBranch?: boolean;
}) {
  if (sessions.length === 0) return <Empty />;
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-muted">
            <th className="py-1.5 pr-3 text-left font-normal">Date</th>
            {showBranch && <th className="py-1.5 pr-3 text-left font-normal">Branch</th>}
            <th className="py-1.5 pr-3 text-right font-normal">Opening</th>
            <th className="py-1.5 pr-3 text-right font-normal">Closing</th>
            <th className="py-1.5 pr-3 text-right font-normal">Expected</th>
            <th className="py-1.5 text-right font-normal">Variance</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-3 text-ink">
                {new Date(`${s.businessDate}T00:00:00Z`).toLocaleDateString()}
                {s.status === "open" && (
                  <span className="ml-1.5 rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-body">
                    Open
                  </span>
                )}
              </td>
              {showBranch && <td className="py-1.5 pr-3 text-muted">{s.shopName}</td>}
              <td className="py-1.5 pr-3 text-right text-body">{formatCurrency(s.openingCash)}</td>
              <td className="py-1.5 pr-3 text-right text-body">
                {s.closingCash != null ? formatCurrency(s.closingCash) : "—"}
              </td>
              <td className="py-1.5 pr-3 text-right text-body">
                {s.expectedCash != null ? formatCurrency(s.expectedCash) : "—"}
              </td>
              <td
                className={`py-1.5 text-right font-medium ${
                  s.variance == null
                    ? "text-muted"
                    : s.variance === 0
                      ? "text-ink"
                      : s.variance > 0
                        ? "text-success"
                        : "text-error"
                }`}
              >
                {s.variance != null ? formatCurrency(s.variance) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CashMovementsTable({
  movements,
  showBranch = false,
}: {
  movements: CashMovementRow[];
  showBranch?: boolean;
}) {
  if (movements.length === 0) return <Empty />;
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-muted">
            <th className="py-1.5 pr-3 text-left font-normal">Date/Time</th>
            {showBranch && <th className="py-1.5 pr-3 text-left font-normal">Branch</th>}
            <th className="py-1.5 pr-3 text-left font-normal">Type</th>
            <th className="py-1.5 pr-3 text-left font-normal">Note</th>
            <th className="py-1.5 pr-3 text-left font-normal">Staff</th>
            <th className="py-1.5 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-3 text-muted">{new Date(m.createdAt).toLocaleString()}</td>
              {showBranch && <td className="py-1.5 pr-3 text-muted">{m.shopName}</td>}
              <td className="py-1.5 pr-3 text-ink">
                {MOVEMENT_TYPE_LABELS[m.movementType]}
                {m.counterpartyName && (
                  <span className="text-muted">
                    {" "}
                    {m.direction === "out" ? "→" : "←"} {m.counterpartyName}
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-muted">{m.note ?? ""}</td>
              <td className="py-1.5 pr-3 text-muted">{m.createdByName ?? ""}</td>
              <td
                className={`py-1.5 text-right font-medium ${
                  m.direction === "in" ? "text-success" : "text-error"
                }`}
              >
                {m.direction === "in" ? "+" : "−"}
                {formatCurrency(m.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
