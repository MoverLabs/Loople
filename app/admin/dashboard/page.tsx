import React from "react";
import { PageHeader } from "../../../components/ui/PageHeader";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function AdminDashboardPage() {
	// TODO: server loader: key metrics for club_id, recent registrations, payouts summary
	return (
		<div>
			<PageHeader title="Admin Dashboard" subtitle="Overview of your club" />
			<div className="grid gap-6 md:grid-cols-2">
				<EmptyState title="Members" description="No members yet" ctaHref="/admin/members/new" ctaLabel="Add member" />
				<EmptyState title="Programs" description="Create programs to organize events" ctaHref="/admin/programs/new" ctaLabel="New program" />
			</div>
		</div>
	);
} 