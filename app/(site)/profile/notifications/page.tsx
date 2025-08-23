import { PageHeader } from "@/components/ui/PageHeader";

export default function NotificationsPage() {
	// TODO: form to toggle email/SMS notifications
	return (
		<div>
			<PageHeader title="Notifications" subtitle="Choose how you want to be notified" />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Notification preferences form</p>
			</div>
		</div>
	);
} 