import React from "react";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ResetPassword() {
	return (
		<div className="container max-w-md py-10">
			<div className="mb-4">
				<h1 className="text-2xl font-semibold">Reset password</h1>
			</div>
			<ForgotPasswordForm />
		</div>
	);
} 