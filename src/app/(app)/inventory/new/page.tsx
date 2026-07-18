import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { NewProductForm } from "./product-form";

export default async function NewProductPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Add product</h1>
      <p className="mt-1 text-sm text-slate-500">
        After creating it, you&apos;ll add its flavors/sizes/nicotine levels
        (or accessory variant) on the next screen.
      </p>
      <div className="mt-6">
        <NewProductForm />
      </div>
    </main>
  );
}
