import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { NewProductForm } from "./product-form";
import { NewFlavorBatchForm } from "./flavor-batch-form";
import { NewAccessoryBatchForm } from "./accessory-batch-form";
import { ACCESSORY_SUBCATEGORIES, getAccessorySubcategory } from "@/lib/inventory/accessory-subcategories";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; category?: string; subcategory?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const { mode, category, subcategory: subcategoryKey } = await searchParams;

  if (mode === "single") {
    return (
      <PageShell title="Add a single product" subtitle="For a one-off item.">
        <NewProductForm />
      </PageShell>
    );
  }

  const supabase = await createClient();

  if (category === "accessory" && subcategoryKey) {
    const subcategory = getAccessorySubcategory(subcategoryKey);
    if (!subcategory) redirect("/inventory/new?category=accessory");

    const { data: brandRows } = await supabase
      .from("products")
      .select("brand")
      .not("brand", "is", null);
    const brands = [...new Set((brandRows ?? []).map((r) => r.brand as string))].sort();

    return (
      <PageShell
        title={`Add ${subcategory.label.toLowerCase()}`}
        subtitle="Pick a brand, list the items, and check off any options that apply — every combination is created at once."
        backHref="/inventory/new?category=accessory"
        backLabel="Change accessory type"
      >
        <NewAccessoryBatchForm
          subcategory={{
            key: subcategory.key,
            label: subcategory.label,
            listLabel: subcategory.listLabel,
            listHelp: subcategory.listHelp,
            variantDimension: subcategory.variantDimension
              ? {
                  label: subcategory.variantDimension.label,
                  options: subcategory.variantDimension.options,
                }
              : undefined,
          }}
          brands={brands}
        />
      </PageShell>
    );
  }

  if (category === "accessory") {
    return (
      <PageShell title="What kind of accessory?" backHref="/inventory/new" backLabel="Change category">
        <div className="grid grid-cols-2 gap-3">
          {ACCESSORY_SUBCATEGORIES.map((s) => (
            <Link key={s.key} href={`/inventory/new?category=accessory&subcategory=${s.key}`}>
              <Card
                padding="md"
                className="h-full text-center transition-shadow hover:shadow-sm"
              >
                <span className="font-medium text-ink">{s.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </PageShell>
    );
  }

  if (category === "ejuice") {
    const { data: brandRows } = await supabase
      .from("products")
      .select("brand")
      .not("brand", "is", null);
    const brands = [...new Set((brandRows ?? []).map((r) => r.brand as string))].sort();

    return (
      <PageShell
        title="Add flavors"
        subtitle="Pick a brand, list the flavors, and check off the nicotine levels each one comes in — every combination is created at once."
        backHref="/inventory/new"
        backLabel="Change category"
      >
        <NewFlavorBatchForm brands={brands} />
      </PageShell>
    );
  }

  return (
    <PageShell title="What are you adding?">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/inventory/new?category=ejuice">
          <Card padding="lg" className="h-full text-center transition-shadow hover:shadow-sm">
            <span className="font-serif text-lg font-normal text-ink">E-juice</span>
          </Card>
        </Link>
        <Link href="/inventory/new?category=accessory">
          <Card padding="lg" className="h-full text-center transition-shadow hover:shadow-sm">
            <span className="font-serif text-lg font-normal text-ink">Accessory</span>
          </Card>
        </Link>
      </div>
      <Link
        href="/inventory/new?mode=single"
        className="mt-6 inline-block text-sm text-muted underline underline-offset-2 hover:text-ink"
      >
        Or add a single product manually
      </Link>
    </PageShell>
  );
}

function PageShell({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="animate-fade-in-up mx-auto max-w-lg px-4 py-8">
      {backHref && (
        <Link href={backHref} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
          ← {backLabel}
        </Link>
      )}
      <h1 className="mt-2 font-serif text-2xl font-normal text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </main>
  );
}
