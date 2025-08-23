import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProfilePage() {
	// TODO: loader: self profile (users) and memberships
	return (
		<div>
			<PageHeader title="Profile" subtitle="Manage your account and household" />
			<EmptyState title="Profile" description="Profile details coming soon" ctaHref="/app/(site)/profile/edit" ctaLabel="Edit profile" />
		</div>
	);
} 