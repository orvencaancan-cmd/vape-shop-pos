"use client";

import { switchShopAction } from "@/lib/auth/actions";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: ShopMembership[];
  activeShopId: string;
}) {
  return (
    <select
      value={activeShopId}
      onChange={(e) => {
        const target = shops.find((s) => s.shopId === e.target.value);
        if (target) switchShopAction(target.shopId, target.role);
      }}
      aria-label="Switch shop"
      className="max-w-[55%] truncate border-none bg-transparent text-center text-sm font-semibold uppercase tracking-[0.25em] text-ink focus:outline-none sm:max-w-[60%] sm:text-lg sm:tracking-[0.35em]"
    >
      {shops.map((s) => (
        <option key={s.shopId} value={s.shopId}>
          {s.shopName}
        </option>
      ))}
    </select>
  );
}
