import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function InvoiceDetailsPage({ params }: { params: { invoiceId: string } }) {
	// TODO: loader: fetch invoice details from Stripe
	return (
		<div>
			<PageHeader title="Invoice" subtitle={`Invoice ${params.invoiceId}`} />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Invoice details</p>
			</div>
		</div>
	);
} 