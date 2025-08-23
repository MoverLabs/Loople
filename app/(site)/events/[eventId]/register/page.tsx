import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { startRegistration } from "./actions";

export default function EventRegisterPage({ params }: { params: { eventId: string } }) {
	return (
		<div>
			<PageHeader title="Register" subtitle={`Event ID ${params.eventId}`} />
			<form action={startRegistration} className="rounded-md border p-6">
				<input type="hidden" name="eventId" value={params.eventId} />
				{/* TODO: select memberId from household */}
				<button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" disabled>
					Start registration
				</button>
			</form>
		</div>
	);
} 