import React from "react";
import TopNav from "../../components/ui/top-nav";
import { AppGuard } from "../../components/guards/AppGuard";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			<div className="min-h-dvh">
				<TopNav />
				<main className="container mx-auto max-w-6xl py-6">{children}</main>
			</div>
		</AppGuard>
	);
} 