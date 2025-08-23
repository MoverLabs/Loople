import React from "react";
import Link from "next/link";

export function EmptyState({
	title = "No data yet",
	description = "Get started by creating a new record.",
	ctaHref,
	ctaLabel,
}: {
	title?: string;
	description?: string;
	ctaHref?: string;
	ctaLabel?: string;
}) {
	return (
		<div className="rounded-md border p-8 text-center">
			<h3 className="text-lg font-medium">{title}</h3>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
			{ctaHref && ctaLabel ? (
				<div className="mt-4">
					<Link className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" href={ctaHref}>
						{ctaLabel}
					</Link>
				</div>
			) : null}
		</div>
	);
} 