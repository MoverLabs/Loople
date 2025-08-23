"use server";

import { getServerSupabase } from "../supabase/server";

export type AppSession = {
	user: { id: string; email: string | null } | null;
	role: "member" | "admin" | "owner" | null;
	clubId: string | null;
};

/**
 * Returns current session with derived role and club context.
 * TODO: Load role from roles table and clubId from memberships/ownership by subdomain.
 */
export async function getSession(): Promise<AppSession> {
	const supabase = getServerSupabase();
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) {
		return { user: null, role: null, clubId: null };
	}
	// TODO: query RLS-safe views to resolve app role and clubId
	return {
		user: { id: data.user.id, email: data.user.email ?? null },
		role: null,
		clubId: null,
	};
} 