"use client";
import React from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div className="container py-10">
			<h1 className="text-2xl font-semibold">Something went wrong</h1>
			<p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
			<button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => reset()}>
				Try again
			</button>
		</div>
	);
} 