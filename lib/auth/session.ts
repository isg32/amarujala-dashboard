import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./server";
import { db } from "@/lib/db";
import { appUsers, pocCenters, pocPermissions } from "@/lib/db/schema";

export type PocPermissions = {
  canRecordPayments: boolean;
  canMarkAttendance: boolean;
  canAddReaders: boolean;
};

const FULL_PERMISSIONS: PocPermissions = { canRecordPayments: true, canMarkAttendance: true, canAddReaders: true };
const NO_PERMISSIONS: PocPermissions = { canRecordPayments: false, canMarkAttendance: false, canAddReaders: false };

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "au_poc";
  centerIds: number[];
  // Always full access for admins. For an AU POC, a missing poc_permissions
  // row (the default — most POCs never get customized) also means full
  // access, so this never silently restricts a POC an admin hasn't touched.
  permissions: PocPermissions;
  // A suspended POC keeps full read access (every lib/data list/get
  // function scopes by role/center only, never by this flag) but every
  // write is blocked — permissions above is forced to NO_PERMISSIONS when
  // this is true, covering 3 of the 4 POC-writable actions for free; the
  // 4th (sendPaymentReminder) checks this flag directly since it has no
  // permissions flag of its own.
  suspended: boolean;
  // A privilege tier above regular admin — lets this account reset another
  // ADMIN's password (any admin can already reset a POC's). Always false
  // for au_poc rows; only meaningful for role === "admin".
  canManageAdminPasswords: boolean;
};

// The single chokepoint that turns a Neon Auth session into an app-level
// identity. Neon Auth sessions carry no role/custom data, so role and
// center-scoping live in our own app_users/poc_centers tables, keyed by the
// Neon Auth user id. A signed-in user with no app_users row has no access —
// AU POC accounts are always admin-created, never self-provisioned.
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const { data } = await auth.getSession();
  if (!data?.user) return null;

  const [row] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, data.user.id));
  if (!row) return null;

  let centerIds: number[] = [];
  let permissions: PocPermissions = FULL_PERMISSIONS;
  if (row.role === "au_poc") {
    const [centerRows, [permRow]] = await Promise.all([
      db.select({ centerId: pocCenters.centerId }).from(pocCenters).where(eq(pocCenters.pocUserId, row.id)),
      db.select().from(pocPermissions).where(eq(pocPermissions.pocUserId, row.id)),
    ]);
    centerIds = centerRows.map((r) => r.centerId);
    if (permRow) {
      permissions = {
        canRecordPayments: permRow.canRecordPayments,
        canMarkAttendance: permRow.canMarkAttendance,
        canAddReaders: permRow.canAddReaders,
      };
    }
    if (row.suspended) permissions = NO_PERMISSIONS;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    centerIds,
    permissions,
    suspended: row.suspended,
    canManageAdminPasswords: row.canManageAdminPasswords,
  };
});

export async function requireAppUser(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireAppUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
