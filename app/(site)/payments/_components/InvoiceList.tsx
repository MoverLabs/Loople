import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export type Invoice = {
	id: string;
	amount_due: number;
	status: string;
	created: string;
	hosted_invoice_url?: string | null;
};

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
	if (!invoices.length) {
		return <EmptyState title="No invoices" description="You have no invoices yet" />;
	}
	return (
		<ul className="divide-y">
			{invoices.map((inv) => (
				<li key={inv.id} className="flex items-center justify-between py-3 text-sm">
					<div>
						<div className="font-medium">${""}{(inv.amount_due / 100).toFixed(2)} • {inv.status}</div>
						<div className="text-muted-foreground">{new Date(inv.created).toLocaleString()}</div>
					</div>
					{inv.hosted_invoice_url ? (
						<a className="text-primary underline" href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
							View
						</a>
					) : null}
				</li>
			))}
		</ul>
	);
} 