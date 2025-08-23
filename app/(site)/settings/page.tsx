import { PageHeader } from "@/components/ui/PageHeader";

export default function SiteSettingsPage() {
	// TODO: user preference settings (timezone, locale)
	return (
		<div>
			<PageHeader title="Settings" subtitle="Personal preferences" />
			<div className="rounded-md border p-6">
				<p className="text-sm text-muted-foreground">TODO: Settings form</p>
			</div>
		</div>
	);
} 