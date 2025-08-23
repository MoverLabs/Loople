import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function MemberDetailsPage({ params }: { params: { memberId: string } }) {
	// TODO: loader: member details and programs
	return (
		<div>
			<PageHeader title="Member" subtitle={`Member ID ${params.memberId}`} />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Member details and actions</p>
			</div>
		</div>
	);
} 