"use server";

import { z } from "zod";

export type ActionState = { error?: string; success?: boolean };

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  message: z.string().min(1, "Message is required"),
});

const CONTACT_TO_EMAIL = "orvencaancan@gmail.com";
const CONTACT_FROM_EMAIL = "VapeStock Contact <noreply@vapestockva.com>";

export async function submitContactAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honeypot: a field named to look legitimate to bots but hidden from real
  // visitors via CSS. Any value here means a bot filled every field blindly
  // -- pretend success without sending anything, so it doesn't learn to
  // avoid this field on a retry.
  if (formData.get("company")) {
    return { success: true };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      reply_to: parsed.data.email,
      subject: `New contact form message from ${parsed.data.name}`,
      text: `From: ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
    }),
  });

  if (!res.ok) {
    return { error: "Something went wrong sending your message. Please try again." };
  }

  return { success: true };
}
