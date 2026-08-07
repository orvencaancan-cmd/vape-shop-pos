import { IncomingInventoryChecklist, OutgoingInventoryList } from "@/components/inventory-transfer-checklist";
import type { PendingInventoryTransfer } from "@/lib/inventory-transfer";

// Owner convenience view -- lets the owner see/receive/cancel any branch's
// pending inventory transfers from one place, without switching into each
// branch. Only renders when there's something pending, same reasoning
// BranchCashCard always shows (a register has a permanent state to
// display) doesn't apply here (no permanent per-branch inventory state to
// show beyond the branch's own full catalog, which lives on /inventory).
export function BranchInventoryCard({
  shopName,
  incoming,
  outgoing,
}: {
  shopName: string;
  incoming: PendingInventoryTransfer[];
  outgoing: PendingInventoryTransfer[];
}) {
  if (incoming.length === 0 && outgoing.length === 0) return null;
  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <h3 className="text-sm font-semibold text-ink">{shopName}</h3>
      <div className="mt-3 flex flex-col gap-3">
        <IncomingInventoryChecklist transfers={incoming} />
        <OutgoingInventoryList transfers={outgoing} canCancel />
      </div>
    </div>
  );
}
