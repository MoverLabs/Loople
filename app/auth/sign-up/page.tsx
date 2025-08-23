import React from "react";
import { SignUpForm } from "@/components/sign-up-form";

export default function SignUp() {
	return (
		<div className="container max-w-md py-10">
			<div className="mb-4">
				<h1 className="text-2xl font-semibold">Create account</h1>
			</div>
			<SignUpForm />
		</div>
	);
} 