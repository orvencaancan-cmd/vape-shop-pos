import { AuthCardShell } from "@/components/auth-card-shell";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <AuthCardShell
      heading="Contact us"
      subtitle="Questions, feedback, or need help? Send us a message and we'll get back to you."
    >
      <ContactForm />
    </AuthCardShell>
  );
}
