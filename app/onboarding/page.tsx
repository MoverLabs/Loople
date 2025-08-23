import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function OnboardingPage() {
	// TODO: Implement stepper: Club info → Branding → Programs (seed) → Invite admins → Done
	// TODO: Writes to clubs, programs, users.role_id; sets onboarding_completed=true via actions
	return (
		<div>
			<PageHeader title="Onboarding" subtitle="Set up your club" />
			<EmptyState title="Start onboarding" description="Complete steps to finish setup" ctaHref="/admin/settings/branding" ctaLabel="Go to settings" />
		</div>
	);
} 