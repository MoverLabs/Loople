import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MembersPage() {
	// TODO: loader: members for household
	return (
		<div>
			<PageHeader title="Members" subtitle="Household members" />
			<EmptyState title="No members" description="Add your first member" ctaHref="/app/(site)/members/add" ctaLabel="Add member" />
		</div>
	);
} 