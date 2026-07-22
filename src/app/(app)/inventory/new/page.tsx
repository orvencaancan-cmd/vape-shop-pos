import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { NewProductForm } from "./product-form";
import { NewFlavorBatchForm } from "./flavor-batch-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const { mode } = await searchParams;
  const isSingle = mode === "single";

  const supabase = await createClient();
  const { data: brandRows } = await supabase
    .from("products")
    .select("brand")
    .not("brand", "is", null);
  const brands = [...new Set((brandRows ?? []).map((r) => r.brand as string))].sort();

  return (
    <main className="animate-fade-in-up mx-auto max-w-lg px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">
        {isSingle ? "Add a single product" : "Add flavors"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {isSingle
          ? "For a one-off item, or an accessory (e.g. a pod, coil, or battery)."
          : "Pick a brand, list the flavors, and check off the nicotine levels each one comes in — every combination is created at once."}
      </p>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/inventory/new"
          className={!isSingle ? "text-primary underline underline-offset-2" : "text-muted hover:text-ink"}
        >
          Add flavors
        </Link>
        <span className="text-muted">·</span>
        <Link
          href="/inventory/new?mode=single"
          className={isSingle ? "text-primary underline underline-offset-2" : "text-muted hover:text-ink"}
        >
          Add single product
        </Link>
      </div>

      <div className="mt-6">
        {isSingle ? <NewProductForm /> : <NewFlavorBatchForm brands={brands} />}
      </div>
    </main>
  );
}
