import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ThreadPage({ params }: { params: { threadId: string } }) {
	// TODO: loader: messages in threadId, participants
	return (
		<div>
			<PageHeader title={`Thread`} subtitle={`Conversation ${params.threadId}`} />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Thread messages and reply box</p>
			</div>
		</div>
	);
} 