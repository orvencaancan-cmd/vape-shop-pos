"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { PriceLabels } from "@/lib/stripe-prices";

export function RatesPopup({
  prices,
  subscribeAction,
}: {
  prices: PriceLabels | null;
  /** When provided, the popup also offers a "Subscribe" shortcut that
   * triggers this exact action -- not a second, separate one. */
  subscribeAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses("secondary", "sm")}
      >
        View rates
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-ink">Pricing</h2>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted">First shop</p>
                <p className="text-base font-medium text-ink">
                  {prices?.primary ?? "Unavailable right now"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Each additional shop</p>
                <p className="text-base font-medium text-ink">
                  {prices?.additional ?? "Unavailable right now"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              {subscribeAction && (
                <form action={subscribeAction} className="flex-1">
                  <button type="submit" className={`w-full ${buttonClasses("primary", "sm")}`}>
                    Subscribe
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${subscribeAction ? "" : "flex-1"} ${buttonClasses("secondary", "sm")}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
