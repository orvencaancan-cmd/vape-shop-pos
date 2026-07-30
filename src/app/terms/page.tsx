import Link from "next/link";
import { VapeStockLogo } from "@/components/vapestock-logo";

const LAST_UPDATED = "July 30, 2026";

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/">
            <VapeStockLogo className="text-xl" />
          </Link>
          <Link href="/" className="text-sm text-body hover:text-ink">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="heading text-3xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-body">
          <Section title="1. Agreement to these terms">
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of
              VapeStock, a point-of-sale and inventory management service for vape shops
              (&quot;VapeStock,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or
              using VapeStock, you agree to these Terms on behalf of yourself and, if
              applicable, the business you represent. If you don&apos;t agree, don&apos;t use the
              service.
            </p>
          </Section>

          <Section title="2. Who this service is for">
            <p>
              VapeStock is a business tool intended for vape shops and similar retail
              businesses to manage inventory and sales. It is not intended for personal or
              consumer use, and it is not itself a marketplace for buying or selling vape
              products. By using VapeStock, you confirm that you are operating a legitimate
              business, that you are authorized to act on that business&apos;s behalf, and that
              your business holds any licenses, permits, or registrations required to sell
              the products you sell under the laws that apply to you. You are solely
              responsible for complying with all laws and regulations relating to the sale
              of vape products in your jurisdiction — VapeStock does not provide legal or
              regulatory advice.
            </p>
          </Section>

          <Section title="3. Accounts and roles">
            <p>
              When you sign up, you become a shop &quot;Owner.&quot; Owners can invite &quot;Staff&quot;
              accounts with limited access — staff can record sales and manage stock, but
              cannot view financial reports, change prices, or manage billing. Owners are
              responsible for the accuracy of information provided during signup, for
              keeping login credentials secure, and for all activity that happens under
              their shop&apos;s account, including actions taken by staff they&apos;ve invited. Let
              us know right away if you believe an account has been accessed without
              authorization.
            </p>
          </Section>

          <Section title="4. Free trial">
            <p>
              New shops get a 14-day free trial with no payment method required to start.
              You can add and manage your inventory, staff, and other shop locations during
              the trial. If you haven&apos;t subscribed by the end of the trial, access to the
              shop is locked until you subscribe — your data is not deleted and becomes
              available again as soon as you subscribe.
            </p>
          </Section>

          <Section title="5. Subscriptions and billing">
            <p>
              After the trial, continued access requires a paid subscription, billed
              monthly through our payment processor, Stripe. Pricing is shown on our
              website and in your Billing settings and may include a different rate for a
              shop owner&apos;s first location versus additional locations. Subscriptions renew
              automatically each billing period until cancelled. You can cancel anytime
              from your Billing settings; cancelling stops future charges but doesn&apos;t
              refund amounts already billed for the current period, and you&apos;ll keep access
              through the end of the period you&apos;ve already paid for. We may change pricing
              with reasonable advance notice; continued use after a price change takes
              effect means you accept the new price.
            </p>
            <p className="mt-3">
              We don&apos;t store your card details ourselves — payment information is handled
              entirely by Stripe under its own terms and privacy policy.
            </p>
          </Section>

          <Section title="6. Your data">
            <p>
              Everything you enter into VapeStock about your business — inventory, sales
              records, staff information, supplier details, and similar business data —
              belongs to you. We store it on your behalf so the service can work, and we
              don&apos;t use it for purposes unrelated to providing VapeStock to you. See our{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>{" "}
              for more detail on what we collect and how it&apos;s handled. You&apos;re responsible
              for the accuracy of the data you enter and for keeping your own copies or
              exports of anything you can&apos;t afford to lose.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Use VapeStock for anything illegal, or to sell products you&apos;re not licensed to sell;</li>
              <li>Try to access another shop&apos;s data or accounts without authorization;</li>
              <li>Reverse-engineer, copy, resell, or redistribute the software itself;</li>
              <li>Interfere with or overload the service (e.g. automated abuse, scraping);</li>
              <li>Use a staff account for anything beyond day-to-day sales and inventory tasks it&apos;s intended for.</li>
            </ul>
          </Section>

          <Section title="8. Service availability">
            <p>
              We work to keep VapeStock available and reliable, but we don&apos;t guarantee
              uninterrupted or error-free service. We may need to perform maintenance,
              and from time to time the service may be unavailable for reasons outside our
              control (for example, an outage at a hosting or infrastructure provider we
              rely on). VapeStock is provided &quot;as is&quot; without warranties of any kind
              beyond what&apos;s required by law.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              To the fullest extent permitted by law, VapeStock and its owner are not
              liable for indirect, incidental, or consequential damages — including lost
              sales, lost profits, or lost data — arising from your use of the service.
              Our total liability for any claim relating to VapeStock is limited to the
              amount you paid us in the 3 months before the claim arose.
            </p>
          </Section>

          <Section title="10. Suspension and termination">
            <p>
              We may suspend or terminate a shop&apos;s access for non-payment, violation of
              these Terms, or use that puts the service or other shops at risk. You may
              stop using VapeStock and cancel your subscription at any time. If your
              account is terminated, provisions of these Terms that by their nature should
              survive (such as limitation of liability) will continue to apply.
            </p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>
              We may update these Terms from time to time. If we make material changes,
              we&apos;ll take reasonable steps to let you know (such as an in-app notice or an
              email). Continuing to use VapeStock after changes take effect means you
              accept the updated Terms.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These Terms are governed by the laws of the Republic of the Philippines,
              without regard to conflict-of-law principles.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about these Terms? Reach us through our{" "}
              <Link href="/contact" className="text-primary underline underline-offset-2">
                Contact page
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-hairline bg-canvas-soft py-6 text-center text-xs text-muted">
        VapeStock
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="heading text-lg text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
