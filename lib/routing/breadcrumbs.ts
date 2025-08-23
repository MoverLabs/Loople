export type Crumb = { href: string; label: string };

/**
 * Builds breadcrumb items from a pathname like /admin/events/123/roster
 * TODO: Add mapping for dynamic labels by loading entity names.
 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
	const [pathOnly] = pathname.split("?");
	const safePath = pathOnly ?? "";
	const parts = safePath.split("/").filter(Boolean);
	const crumbs: Crumb[] = [];
	let acc = "";
	for (const part of parts) {
		acc += `/${part}`;
		crumbs.push({ href: acc, label: normalize(part) });
	}
	return crumbs;
}

function normalize(segment: string): string {
	if (segment === "admin") return "Admin";
	if (segment === "auth") return "Auth";
	if (segment === "page.tsx") return "";
	if (segment.startsWith("[")) return "Details";
	return segment
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
} 