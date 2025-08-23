import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
	if (!client) {
		client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
	}
	return client;
} 