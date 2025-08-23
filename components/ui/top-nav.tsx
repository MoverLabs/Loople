import React from "react";
import Link from "next/link";

export default function TopNav() {
	return (
		<header className="border-b">
			<nav className="container mx-auto flex max-w-6xl items-center justify-between py-3">
				<Link href="/" className="font-semibold">
					Loople
				</Link>
				<div className="flex items-center gap-4 text-sm">
					<Link href="/profile">Profile</Link>
					<Link href="/support">Support</Link>
				</div>
			</nav>
		</header>
	);
} 