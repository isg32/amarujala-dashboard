import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./server";
import { db } from "@/lib/db";
import { appUsers, pocCenters } from "@/lib/db/schema";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "au_poc";
  centerIds: number[];
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
  if (row.role === "au_poc") {
    const rows = await db
      .select({ centerId: pocCenters.centerId })
      .from(pocCenters)
      .where(eq(pocCenters.pocUserId, row.id));
    centerIds = rows.map((r) => r.centerId);
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role, centerIds };
});

export async function requireAppUser(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireAppUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
