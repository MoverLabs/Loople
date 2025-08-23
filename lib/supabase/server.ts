import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "../env";

export function getServerSupabase(): SupabaseClient {
	const cookieStore = cookies();
	return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			get(name: string) {
				return cookieStore.get(name)?.value;
			},
			set(name: string, value: string, options: any) {
				try {
					cookieStore.set({ name, value, ...options });
				} catch {
					// no-op in read-only contexts
				}
			},
			remove(name: string, options: any) {
				try {
					cookieStore.set({ name, value: "", ...options, maxAge: 0 });
				} catch {
					// no-op in read-only contexts
				}
			},
		},
	});
} 