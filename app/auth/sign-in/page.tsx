import React from "react";
import { LoginForm } from "@/components/login-form";

export default function SignIn() {
	return (
		<div className="container max-w-md py-10">
			<div className="mb-4">
				<h1 className="text-2xl font-semibold">Sign in</h1>
			</div>
			<LoginForm />
		</div>
	);
} 