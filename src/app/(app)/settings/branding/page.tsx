import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { LogoForm, ColorForm } from "./branding-forms";

export default async function BrandingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Branding</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-500">Logo</h2>
        <div className="mt-2">
          <LogoForm currentLogoUrl={profile.shop.logoUrl} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-500">Primary color</h2>
        <div className="mt-2">
          <ColorForm currentColor={profile.shop.primaryColor ?? "#0f172a"} />
        </div>
      </section>
    </main>
  );
}
