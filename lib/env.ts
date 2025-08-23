import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
	(val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
	z.string().min(1).optional()
);

const envSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
	NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: optionalNonEmptyString,
});

const raw = {
	NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
	NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
	throw new Error(
		`Invalid environment variables for Supabase. Please set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY.\n${parsed.error.toString()}`
	);
}

const values = parsed.data;

const anonKey = values.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

if (!anonKey) {
	throw new Error(
		"Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY."
	);
}

export const env = {
	NEXT_PUBLIC_SUPABASE_URL: values.NEXT_PUBLIC_SUPABASE_URL,
	NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
}; 