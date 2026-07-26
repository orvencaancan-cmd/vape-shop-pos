import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ColorForm, LogoForm } from "./branding-forms";

export default async function BrandingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }
  if (profile.role !== "owner") redirect("/inventory");

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <h1 className="heading text-2xl">Branding</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Primary color</h2>
        <div className="mt-2">
          <ColorForm currentColor={profile.shop.primaryColor ?? "#1f5c96"} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">Logo</h2>
        <div className="mt-2">
          <LogoForm currentLogoUrl={profile.shop.logoUrl} />
        </div>
      </section>
    </main>
  );
}
