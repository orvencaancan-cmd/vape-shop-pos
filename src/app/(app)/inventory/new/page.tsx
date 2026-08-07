import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/action-button";
import { NewProductForm } from "./product-form";
import { NewFlavorBatchForm } from "./flavor-batch-form";
import { NewFlavorPodBatchForm } from "./flavor-pod-batch-form";
import { NewAccessoryBatchForm } from "./accessory-batch-form";
import { NewCustomCategoryForm } from "./custom-category-form";
import { PRODUCT_CATEGORIES, getProductCategory } from "@/lib/inventory/product-categories";
import { fetchCustomCategories } from "@/lib/inventory/custom-categories";
import { archiveCustomCategoryAction } from "../actions";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; category?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const { mode, category: categoryKey } = await searchParams;

  if (mode === "single") {
    if (profile.role !== "owner") redirect("/inventory/new");
    const supabase = await createClient();
    const customCategories = await fetchCustomCategories(supabase);
    return (
      <PageShell title="Add a single product" subtitle="For a one-off item.">
        <NewProductForm customCategories={customCategories.map((c) => ({ key: c.key, label: c.label }))} />
      </PageShell>
    );
  }

  if (mode === "new-category") {
    if (profile.role !== "owner") redirect("/inventory/new");
    return (
      <PageShell
        title="New category"
        subtitle="Shared across all of your branches."
        backHref="/inventory/new"
        backLabel="Change category"
      >
        <NewCustomCategoryForm />
      </PageShell>
    );
  }

  const supabase = await createClient();
  const customCategories = await fetchCustomCategories(supabase);

  if (categoryKey && categoryKey !== "ejuice") {
    const builtInCategory = getProductCategory(categoryKey);
    const category = builtInCategory ?? customCategories.find((c) => c.key === categoryKey);
    if (!category) redirect("/inventory/new");
    const isCustomCategory = !builtInCategory;

    const { data: brandRows } = await supabase
      .from("products")
      .select("brand")
      .eq("shop_id", profile.shopId)
      .not("brand", "is", null);
    const brands = [...new Set((brandRows ?? []).map((r) => r.brand as string))].sort();

    const archiveControl =
      isCustomCategory && profile.role === "owner" ? (
        <ActionButton
          action={archiveCustomCategoryAction.bind(null, category.key)}
          confirmMessage={`Archive "${category.label}"? It won't show up when adding new products, but existing ones keep this category.`}
          className="mt-2 block text-xs text-muted underline underline-offset-2 hover:text-error"
        >
          Archive this category
        </ActionButton>
      ) : null;

    if (categoryKey === "flavor-pod") {
      return (
        <PageShell
          title="Flavor Pods"
          subtitle="Pick a brand, then list the flavors — each becomes its own product."
          backHref="/inventory/new"
          backLabel="Change category"
          afterHeader={archiveControl}
        >
          <NewFlavorPodBatchForm brands={brands} role={profile.role} />
        </PageShell>
      );
    }

    return (
      <PageShell
        title={`Add ${category.label.toLowerCase()}`}
        subtitle="Pick a brand, list the items, and check off any options that apply — every combination is created at once."
        backHref="/inventory/new"
        backLabel="Change category"
        afterHeader={archiveControl}
      >
        <NewAccessoryBatchForm
          category={{
            key: category.key,
            label: category.label,
            listLabel: category.listLabel,
            listHelp: category.listHelp,
            variantDimension:
              category.variantDimension?.inputType === "checklist"
                ? {
                    label: category.variantDimension.label,
                    inputType: "checklist",
                    options: category.variantDimension.options,
                  }
                : category.variantDimension?.inputType === "freeText"
                  ? {
                      label: category.variantDimension.label,
                      inputType: "freeText",
                      placeholder: category.variantDimension.placeholder,
                    }
                  : undefined,
          }}
          brands={brands}
          role={profile.role}
        />
      </PageShell>
    );
  }

  if (categoryKey === "ejuice") {
    const { data: brandRows } = await supabase
      .from("products")
      .select("brand")
      .eq("shop_id", profile.shopId)
      .not("brand", "is", null);
    const brands = [...new Set((brandRows ?? []).map((r) => r.brand as string))].sort();

    const { data: supplierRows } = await supabase
      .from("suppliers")
      .select("name")
      .eq("shop_id", profile.shopId);
    const suppliers = [...new Set((supplierRows ?? []).map((r) => r.name as string))].sort();

    return (
      <PageShell
        title="E-juice"
        subtitle="Pick a brand, then fill in cost, price, and flavors separately for each nicotine level you carry."
        backHref="/inventory/new"
        backLabel="Change category"
      >
        <NewFlavorBatchForm brands={brands} suppliers={suppliers} role={profile.role} />
      </PageShell>
    );
  }

  return (
    <PageShell title="What are you adding?">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/inventory/new?category=ejuice">
          <Card padding="lg" className="h-full text-center transition-shadow hover:shadow-sm">
            <span className="heading text-lg">E-juice</span>
          </Card>
        </Link>
        {PRODUCT_CATEGORIES.map((c) => (
          <Link key={c.key} href={`/inventory/new?category=${c.key}`}>
            <Card padding="lg" className="h-full text-center transition-shadow hover:shadow-sm">
              <span className="heading text-lg">{c.label}</span>
            </Card>
          </Link>
        ))}
        {customCategories.map((c) => (
          <Link key={c.key} href={`/inventory/new?category=${c.key}`}>
            <Card padding="lg" className="h-full text-center transition-shadow hover:shadow-sm">
              <span className="heading text-lg">{c.label}</span>
            </Card>
          </Link>
        ))}
        {profile.role === "owner" && (
          <Link href="/inventory/new?mode=new-category">
            <Card
              padding="lg"
              className="h-full border-dashed text-center transition-shadow hover:shadow-sm"
            >
              <span className="heading text-lg text-muted">+ Add category</span>
            </Card>
          </Link>
        )}
      </div>
      {profile.role === "owner" && (
        <Link
          href="/inventory/new?mode=single"
          className="mt-6 inline-block text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          Or add a single product manually
        </Link>
      )}
    </PageShell>
  );
}

function PageShell({
  title,
  subtitle,
  backHref,
  backLabel,
  afterHeader,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  afterHeader?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="animate-fade-in-up mx-auto max-w-lg px-4 py-8">
      {backHref && (
        <Link href={backHref} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
          ← {backLabel}
        </Link>
      )}
      <h1 className="heading mt-2 text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      {afterHeader}
      <div className="mt-6">{children}</div>
    </main>
  );
}
