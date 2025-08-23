import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProgramsPage() {
	// TODO: loader: programs available to household (join program_memberships)
	return (
		<div>
			<PageHeader title="Programs" subtitle="Explore programs and enroll" />
			<EmptyState title="No programs" description="No programs found" />
		</div>
	);
} 