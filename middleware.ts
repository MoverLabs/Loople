import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	if (pathname.startsWith("/admin")) {
		// TODO: Replace with server-side role lookup via Supabase session
		const token = req.cookies.get("sb-access-token")?.value;
		if (!token) {
			const url = req.nextUrl.clone();
			url.pathname = "/auth/sign-in";
			url.searchParams.set("redirectedFrom", pathname);
			return NextResponse.redirect(url);
		}
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/:path*"],
}; 