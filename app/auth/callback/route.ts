import { NextResponse } from "next/server";
// TODO: Use getServerSupabase() and supabase.auth.exchangeCodeForSession in this route

export async function GET(req: Request) {
	const url = new URL(req.url);
	// const code = url.searchParams.get("code");
	// if (code) { await supabase.auth.exchangeCodeForSession(code) }
	const next = url.searchParams.get("next") || "/";
	return NextResponse.redirect(new URL(next, url.origin));
} 