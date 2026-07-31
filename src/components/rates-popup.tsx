"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

export function RatesPopup({ amounts }: { amounts: { primary: number; additional: number } }) {
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
                  ₱{amounts.primary.toFixed(2)} PHP / month
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Each additional shop</p>
                <p className="text-base font-medium text-ink">
                  ₱{amounts.additional.toFixed(2)} PHP / month
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`flex-1 ${buttonClasses("secondary", "sm")}`}
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
