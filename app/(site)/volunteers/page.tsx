import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function VolunteersPage() {
	// TODO: loader: volunteer opportunities and signups
	return (
		<div>
			<PageHeader title="Volunteers" subtitle="Help out with your club" />
			<EmptyState title="No opportunities" description="Check back later" />
		</div>
	);
} 