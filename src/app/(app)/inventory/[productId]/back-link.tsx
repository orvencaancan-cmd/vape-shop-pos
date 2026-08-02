"use client";

import { useRouter } from "next/navigation";

export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-xs text-muted underline underline-offset-2 hover:text-ink"
    >
      ← Back
    </button>
  );
}
