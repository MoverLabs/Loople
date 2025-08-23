import type { Invoice } from "../_components/InvoiceList";

export async function loadInvoicesForUser(_userId: string, _clubId?: string): Promise<Invoice[]> {
	// TODO: fetch from Stripe: list invoices by customer (mapped from user/club)
	// Be sure to use server-side keys and RLS-aware data mapping
	return [];
} 