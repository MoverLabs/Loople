import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnnouncementsPage() {
	// TODO: loader: club announcements
	return (
		<div>
			<PageHeader title="Announcements" subtitle="Latest updates" />
			<EmptyState title="No announcements" description="Nothing to show" />
		</div>
	);
} 