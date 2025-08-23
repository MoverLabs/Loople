import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvoiceList } from "./_components/InvoiceList";

export default async function PaymentsPage() {
	// TODO: loader: get invoices for current user/household via Stripe
	const invoices: Parameters<typeof InvoiceList>[0]["invoices"] = [];
	return (
		<div>
			<PageHeader title="Payments" subtitle="Your invoices and receipts" />
			<InvoiceList invoices={invoices} />
		</div>
	);
} 