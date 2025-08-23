import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MessagesPage() {
	// TODO: loader: threads for current user/household
	return (
		<div>
			<PageHeader title="Messages" subtitle="Conversations with your club" />
			<EmptyState title="No messages" description="Start a new conversation" ctaHref="/app/(site)/messages/new" ctaLabel="New message" />
		</div>
	);
} 