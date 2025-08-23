import React from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";

export default function SiteHomePage() {
	// TODO: server loader: load latest announcements, upcoming events, recent invoices
	// Source: events, programs, program_memberships, Stripe invoices (by user/household)
	return (
		<div>
			<PageHeader title="Home" subtitle="Your feed and upcoming activities" />
			<div className="grid gap-6 md:grid-cols-2">
				<EmptyState title="Announcements" description="No announcements yet" />
				<EmptyState title="Upcoming Events" description="No events found" />
				<EmptyState title="Recent Invoices" description="No invoices yet" ctaHref="/app/(site)/payments" ctaLabel="View payments" />
			</div>
		</div>
	);
} 