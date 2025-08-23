import React, { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth/session";
import { isAdmin } from "../../lib/auth/roles";

export default async function AdminGuard({ children }: { children: ReactNode }) {
	const session = await getSession();
	if (!session.user || !isAdmin(session.role)) {
		redirect("/auth/sign-in");
	}
	// TODO: verify club from subdomain matches session.clubId
	return <>{children}</>;
} 