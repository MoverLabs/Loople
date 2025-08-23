import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function EventsPage() {
	// TODO: loader: upcoming events (by club/program)
	return (
		<div>
			<PageHeader title="Events" subtitle="Upcoming club events" />
			<EmptyState title="No events" description="No upcoming events" />
		</div>
	);
} 