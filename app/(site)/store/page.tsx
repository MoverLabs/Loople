import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function StorePage() {
	// TODO: loader: merchandise or fees catalog
	return (
		<div>
			<PageHeader title="Store" subtitle="Merchandise and fees" />
			<EmptyState title="No items" description="Store is empty" />
		</div>
	);
} 