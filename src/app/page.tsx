import Link from "next/link";
import { getStripe } from "@/lib/stripe";

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
  const priceLabel = await getPriceLabel();

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold text-slate-900">VapeStock</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            POS &amp; inventory built for vape shops
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Track e-juice flavors, nicotine strengths, and sizes, ring up sales
            that deduct stock automatically, and see what&apos;s low — from
            your phone or your computer.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white"
            >
              Start your free trial
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700"
            >
              Log in
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-medium text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-md px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Simple pricing</h2>
          <p className="mt-2 text-4xl font-bold text-slate-900">
            {priceLabel ?? "One flat monthly price"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            14-day free trial. No charge until it ends. Cancel anytime.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white"
          >
            Start free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        VapeStock
      </footer>
    </div>
  );
}
