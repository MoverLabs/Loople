"use server";

import { z } from "zod";
// import { createCheckout } from "@/lib/server/checkout";

const startRegistrationSchema = z.object({
	eventId: z.string().min(1),
	memberId: z.string().min(1),
});

export async function startRegistration(_formData: FormData): Promise<void> {
	// TODO: parse formData, create pending registration in DB, then redirect to Stripe Checkout
	// const parsed = startRegistrationSchema.parse({ eventId, memberId })
	// const url = await createCheckout(...)
	// redirect(url)
} 