"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "../../lib/supabase/client";

export function AppGuard({ children }: { children: ReactNode }) {
	const [authed, setAuthed] = useState<boolean | null>(null);

	useEffect(() => {
		const supabase = getBrowserSupabase();
		supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
		const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(Boolean(session)));
		return () => {
			sub.subscription.unsubscribe();
		};
	}, []);

	if (authed === null) return null;
	if (!authed)
		return (
			<div className="container py-10">
				<div className="rounded-md border p-6">
					<h2 className="text-xl font-semibold">You need to sign in</h2>
					<p className="mt-2 text-sm text-muted-foreground">Please sign in to continue.</p>
					<div className="mt-4">
						<Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href="/auth/sign-in">
							Sign in
						</Link>
					</div>
				</div>
			</div>
		);
	return <>{children}</>;
} 