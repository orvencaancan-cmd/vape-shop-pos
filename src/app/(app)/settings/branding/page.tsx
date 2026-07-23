import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ColorForm } from "./branding-forms";

export default async function BrandingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
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
    </main>
  );
}
