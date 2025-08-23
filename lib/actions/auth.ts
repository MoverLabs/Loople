"use server";

import { getServerSupabase } from "../supabase/server";

export async function signInWithEmail(email: string, password: string): Promise<{ error?: string }> {
	const supabase = getServerSupabase();
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	return error ? { error: error.message } : {};
}

export async function signUpWithEmail(email: string, password: string): Promise<{ error?: string }> {
	const supabase = getServerSupabase();
	const { error } = await supabase.auth.signUp({ email, password });
	return error ? { error: error.message } : {};
} 