import React from "react";
import TopNav from "../../components/ui/top-nav";
import AdminGuard from "../../components/guards/AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	return (
		<AdminGuard>
			<div className="min-h-dvh">
				<TopNav />
				<div className="container mx-auto max-w-6xl py-6">
					<main>{children}</main>
				</div>
			</div>
		</AdminGuard>
	);
} 