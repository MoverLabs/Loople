import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DocumentsPage() {
	// TODO: loader: club documents available to members
	return (
		<div>
			<PageHeader title="Documents" subtitle="Policies and forms" />
			<EmptyState title="No documents" description="No documents available" />
		</div>
	);
} 