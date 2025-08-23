import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EventDetailsPage({ params }: { params: { eventId: string } }) {
	// TODO: loader: event details and register CTA
	return (
		<div>
			<PageHeader title="Event" subtitle={`Event ID ${params.eventId}`} />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Event details and register link</p>
			</div>
		</div>
	);
} 