import React from "react";
import { UpdatePasswordForm } from "@/components/update-password-form";

export default function UpdatePassword() {
	return (
		<div className="container max-w-md py-10">
			<div className="mb-4">
				<h1 className="text-2xl font-semibold">Update password</h1>
			</div>
			<UpdatePasswordForm />
		</div>
	);
}
