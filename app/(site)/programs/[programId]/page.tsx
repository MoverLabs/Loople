import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ProgramDetailsPage({ params }: { params: { programId: string } }) {
	// TODO: loader: program details and enrollment options
	return (
		<div>
			<PageHeader title="Program" subtitle={`Program ID ${params.programId}`} />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Program details and enroll action</p>
			</div>
		</div>
	);
} 