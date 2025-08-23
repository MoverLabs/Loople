import { getBrowserSupabase } from "@/lib/supabase/client";

export function createClient() {
	return getBrowserSupabase();
}
