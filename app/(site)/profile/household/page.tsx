import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function HouseholdPage() {
	// TODO: loader: household members and guardians
	return (
		<div>
			<PageHeader title="Household" subtitle="Family and guardians" />
			<EmptyState title="Household" description="No household members yet" ctaHref="/app/(site)/members/add" ctaLabel="Add member" />
		</div>
	);
} 