import Link from "next/link";
import { VapeStockLogo } from "@/components/vapestock-logo";

const LAST_UPDATED = "July 30, 2026";

export default function PrivacyPage() {
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
        <h1 className="heading text-3xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-body">
          <Section title="1. What this policy covers">
            <p>
              This Privacy Policy explains what information VapeStock collects when you
              use our point-of-sale and inventory management service, how we use it, and
              the choices you have. It applies to shop owners and staff who use VapeStock,
              and to visitors of our website.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>When you sign up and use VapeStock, we collect:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-medium text-ink">Account information</span> — your
                email address, display name, and role (owner or staff) for each shop you&apos;re
                part of.
              </li>
              <li>
                <span className="font-medium text-ink">Business data you enter</span> —
                shop details, inventory and product information, sales and transaction
                records, supplier information, and staff you invite. This is your business
                data; we store it so the service can work.
              </li>
              <li>
                <span className="font-medium text-ink">Contact form submissions</span> —
                if you message us through our Contact page, we collect the name, email, and
                message you provide.
              </li>
              <li>
                <span className="font-medium text-ink">Billing information</span> — handled
                entirely by our payment processor, Stripe. We don&apos;t receive or store your
                card number ourselves; we only see subscription status (e.g. active,
                trialing, canceled) and billing dates.
              </li>
              <li>
                <span className="font-medium text-ink">Essential session data</span> — a
                small amount of technical data (like a login session and which shop you
                currently have selected) stored in cookies, needed to keep you signed in
                and show you the right shop&apos;s data.
              </li>
            </ul>
            <p className="mt-3">
              We don&apos;t use advertising or analytics tracking cookies, and we don&apos;t sell
              your data to anyone.
            </p>
          </Section>

          <Section title="3. How we use this information">
            <p>We use the information above to:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Provide and operate the service — running your sales, inventory, and reports;</li>
              <li>Process subscription payments and communicate about billing;</li>
              <li>Send account-related emails, such as sign-up confirmation, staff invites, and password resets;</li>
              <li>Respond to messages sent through our Contact page;</li>
              <li>Maintain the security and reliability of the service.</li>
            </ul>
          </Section>

          <Section title="4. Who we share it with">
            <p>
              We don&apos;t sell or rent your data. We share the minimum necessary information
              with the service providers that make VapeStock work:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-medium text-ink">Supabase</span> — our database,
                authentication, and file storage provider, where your account and business
                data is stored;
              </li>
              <li>
                <span className="font-medium text-ink">Vercel</span> — our hosting
                provider, which runs the application;
              </li>
              <li>
                <span className="font-medium text-ink">Stripe</span> — our payment
                processor, which handles subscription billing and card details directly;
              </li>
              <li>
                <span className="font-medium text-ink">Resend</span> — our email provider,
                used to deliver account and transactional emails.
              </li>
            </ul>
            <p className="mt-3">
              We may also disclose information if required by law, or to protect the
              rights, property, or safety of VapeStock, our users, or others.
            </p>
          </Section>

          <Section title="5. Data retention">
            <p>
              We keep your account and business data for as long as your account is
              active, so your shop&apos;s history stays available to you. If you&apos;d like your
              data deleted — for example, after closing your shop for good — reach out
              through our{" "}
              <Link href="/contact" className="text-primary underline underline-offset-2">
                Contact page
              </Link>{" "}
              and we&apos;ll take care of it.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>
              Depending on where you&apos;re located, you may have rights under applicable
              data protection law — including the Philippines&apos; Data Privacy Act of 2012 —
              to access, correct, or request deletion of your personal information. You can
              update most of your account information directly in the app; for anything
              else, contact us and we&apos;ll help.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use industry-standard measures to protect your data, including encrypted
              connections (HTTPS) and access controls that keep each shop&apos;s data separate
              from every other shop&apos;s. No method of transmission or storage is perfectly
              secure, but we take reasonable steps to protect your information.
            </p>
          </Section>

          <Section title="8. Children's privacy">
            <p>
              VapeStock is a business tool for adults operating a retail business and is
              not directed at, or intended for use by, children. We don&apos;t knowingly
              collect information from anyone under 18.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. If we make material
              changes, we&apos;ll take reasonable steps to let you know, such as an in-app
              notice or an email.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this Privacy Policy or your data? Reach us through our{" "}
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
