import React from "react";
import Link from "next/link";
import { buildBreadcrumbs } from "../../lib/routing/breadcrumbs";

export function PageHeader({
	title,
	subtitle,
	primaryAction,
	pathname,
}: {
	title: string;
	subtitle?: string;
	primaryAction?: React.ReactNode;
	pathname?: string;
}) {
	const crumbs = buildBreadcrumbs(pathname ?? "");
	return (
		<div className="mb-4 border-b pb-4">
			<nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
				{crumbs.map((c, i) => (
					<span key={c.href}>
						<Link className="hover:underline" href={c.href}>
							{c.label}
						</Link>
						{i < crumbs.length - 1 ? " / " : null}
					</span>
				))}
			</nav>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold leading-tight">{title}</h1>
					{subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
				</div>
				{primaryAction ? <div className="shrink-0">{primaryAction}</div> : null}
			</div>
		</div>
	);
} 