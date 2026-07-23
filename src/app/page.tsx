import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeaturePanel } from "@/components/feature-panel";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

async function getPriceLabel() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return null;
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const amount = (price.unit_amount ?? 0) / 100;
    return `${amount.toFixed(2)} ${price.currency.toUpperCase()} / month`;
  } catch {
    return null;
  }
}

const FEATURES = [
  {
    title: "Inventory built for e-juice",
    body: "Track flavor, nicotine strength, and size as separate variants — plus accessories — with low-stock alerts so you never run out.",
  },
  {
    title: "Ring up sales",
    body: "A simple point-of-sale screen deducts stock automatically the moment you make a sale.",
  },
  {
    title: "Reports that matter",
    body: "Revenue, profit, best sellers, slow movers, and inventory value — by day, week, or month.",
  },
  {
    title: "Staff accounts",
    body: "Invite your team with limited access — they can sell and restock, without touching prices or reports.",
  },
  {
    title: "Your branding",
    body: "Add your shop's logo and color so the app feels like yours.",
  },
  {
    title: "Phone or PC",
    body: "Install it like an app on your phone, or use it in any browser on your computer — same account, same data.",
  },
];

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(profile.role === "owner" ? "/dashboard" : "/sell");
  }

  const priceLabel = await getPriceLabel();

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="heading text-lg">VapeStock</span>
          <nav className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <Link href="/login" className="text-body hover:text-ink">
              Log in
            </Link>
            <Link href="/signup" className={buttonClasses("primary", "md")}>
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h1 className="animate-fade-in-up heading text-4xl sm:text-6xl">
              POS &amp; inventory built for vape shops
            </h1>
            <p
              className="animate-fade-in-up mt-5 max-w-xl text-lg text-body"
              style={{ animationDelay: "80ms" }}
            >
              Track e-juice flavors, nicotine strengths, and sizes, ring up sales
              that deduct stock automatically, and see what&apos;s low — from
              your phone or your computer.
            </p>
            <div
              className="animate-fade-in-up mt-8 flex gap-3"
              style={{ animationDelay: "160ms" }}
            >
              <Link href="/signup" className={buttonClasses("primary", "md")}>
                Start your free trial
              </Link>
              <Link href="/login" className={buttonClasses("secondary", "md")}>
                Log in
              </Link>
            </div>
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">What it does</p>
            <FeaturePanel className="mt-4" />
          </div>
        </section>

        <section className="border-t border-hairline bg-canvas-soft px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-primary">
              What you get
            </p>
            <h2 className="heading mt-3 text-center text-2xl sm:text-3xl">
              Everything your shop needs to run day to day
            </h2>
            <div className="stagger mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} padding="md" className="transition-shadow hover:shadow-sm">
                  <h3 className="font-medium text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm text-body">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-hairline px-4 py-20 text-center sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h2 className="heading mt-3 text-3xl">Simple pricing</h2>
          <p className="heading mt-2 text-4xl">{priceLabel ?? "One flat monthly price"}</p>
          <p className="mt-2 text-sm text-body">
            14-day free trial. No charge until it ends. Cancel anytime.
          </p>
          <Link href="/signup" className={`mt-6 inline-flex ${buttonClasses("primary", "md")}`}>
            Start free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-hairline bg-canvas-soft py-6 text-center text-xs text-muted">
        VapeStock
      </footer>
    </div>
  );
}
