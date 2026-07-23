import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { signOutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui/button";

export default async function ShopSuspendedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shop.suspended || profile.platformAdmin) {
    redirect(profile.role === "owner" ? "/dashboard" : "/sell");
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="animate-fade-in-up font-serif text-2xl font-normal text-ink">
        Access paused
      </h1>
      <p
        className="animate-fade-in-up text-sm text-body"
        style={{ animationDelay: "60ms" }}
      >
        {profile.shop.name}&apos;s access has been paused. Contact{" "}
        <a
          href="mailto:orvencaancan@gmail.com"
          className="text-primary underline underline-offset-2"
        >
          orvencaancan@gmail.com
        </a>{" "}
        for help.
      </p>
      <form
        action={signOutAction}
        className="animate-fade-in-up"
        style={{ animationDelay: "120ms" }}
      >
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Log out
        </button>
      </form>
    </main>
  );
}
