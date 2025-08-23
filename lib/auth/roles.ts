export type AppRole = "member" | "admin" | "owner";

export const ROLES = {
	MEMBER: "member" as AppRole,
	ADMIN: "admin" as AppRole,
	OWNER: "owner" as AppRole,
};

export function isAdmin(role: AppRole | null | undefined): boolean {
	return role === ROLES.ADMIN || role === ROLES.OWNER;
}

export function isOwner(role: AppRole | null | undefined): boolean {
	return role === ROLES.OWNER;
}

export function hasClubAccess(userId: string | null | undefined, clubId: string | null | undefined): boolean {
	// TODO: implement via membership join (program_memberships or club_memberships)
	return Boolean(userId && clubId);
} 