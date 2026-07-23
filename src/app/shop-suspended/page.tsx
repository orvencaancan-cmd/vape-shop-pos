import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AuthCardShell } from "@/components/auth-card-shell";

export default async function ShopSuspendedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shop.suspended || profile.platformAdmin) {
    redirect(profile.role === "owner" ? "/dashboard" : "/sell");
  }

  return (
    <AuthCardShell
      heading="Access paused"
      subtitle={
        <>
          {profile.shop.name}&apos;s access has been paused. Contact{" "}
          <a
            href="mailto:orvencaancan@gmail.com"
            className="text-primary underline underline-offset-2"
          >
            orvencaancan@gmail.com
          </a>{" "}
          for help.
        </>
      }
      showLogout
    />
  );
}
