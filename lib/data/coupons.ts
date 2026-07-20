import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { requireAdmin, requireAppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { coupons, readerCoupons, readers, appUsers } from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { postLedgerEntry } from "@/lib/billing/ledger";

// Active AND not budget-exhausted — the only list offered wherever a coupon
// can actually be picked to use (Apply Coupon, payment-link voucher). A
// coupon that's used up shouldn't be selectable at all, not just rejected
// after the fact — listAllCoupons() below still shows it for management.
export async function listCoupons() {
  await requireAppUser();
  const activeCoupons = await db.select().from(coupons).where(eq(coupons.active, true)).orderBy(asc(coupons.code));

  const budgeted = activeCoupons.filter((c) => c.totalBudget != null);
  if (budgeted.length === 0) return activeCoupons;

  const usedRows = await db
    .select({ couponId: readerCoupons.couponId, used: sql<string>`coalesce(sum(${readerCoupons.appliedAmount}), 0)` })
    .from(readerCoupons)
    .where(inArray(readerCoupons.couponId, budgeted.map((c) => c.id)))
    .groupBy(readerCoupons.couponId);
  const usedByCoupon = new Map(usedRows.map((r) => [r.couponId, Number(r.used)]));

  return activeCoupons.filter((c) => {
    if (c.totalBudget == null) return true;
    return Number(c.totalBudget) - (usedByCoupon.get(c.id) ?? 0) > 0;
  });
}

// For the admin coupon-management table, which needs to see (and re-enable)
// inactive coupons too — listCoupons() above stays active-only since it
// also feeds the apply-to-reader dropdown, which shouldn't offer inactive
// codes.
export async function listAllCoupons() {
  await requireAdmin();
  return db.select().from(coupons).orderBy(asc(coupons.code));
}

export async function createCoupon(
  code: string,
  description: string | undefined,
  discountAmount: number,
  totalBudget?: number
) {
  const user = await requireAdmin();
  await db.insert(coupons).values({
    code,
    description,
    discountAmount: discountAmount.toFixed(2),
    totalBudget: totalBudget != null ? totalBudget.toFixed(2) : undefined,
    createdBy: user.id,
  });
}

export async function updateCoupon(
  id: number,
  input: { description?: string; discountAmount: number; active: boolean; totalBudget: number | null }
) {
  await requireAdmin();
  await db
    .update(coupons)
    .set({
      description: input.description,
      discountAmount: input.discountAmount.toFixed(2),
      active: input.active,
      totalBudget: input.totalBudget != null ? input.totalBudget.toFixed(2) : null,
    })
    .where(eq(coupons.id, id));
}

export async function deleteCoupon(id: number) {
  await requireAdmin();
  try {
    await db.delete(coupons).where(eq(coupons.id, id));
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } } | null;
    if (e && (e.code === "23503" || e.cause?.code === "23503")) {
      throw new Error("Cannot delete — this coupon has already been applied to one or more readers.");
    }
    throw err;
  }
}

export async function listCouponsForReader(readerId: number) {
  const user = await requireAppUser();
  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  assertCenterInScope(user, reader.centerId);

  return db
    .select({
      id: readerCoupons.id,
      couponCode: coupons.code,
      couponDescription: coupons.description,
      appliedAmount: readerCoupons.appliedAmount,
      appliedAt: readerCoupons.appliedAt,
      remarks: readerCoupons.remarks,
    })
    .from(readerCoupons)
    .innerJoin(coupons, eq(readerCoupons.couponId, coupons.id))
    .where(eq(readerCoupons.readerId, readerId))
    .orderBy(desc(readerCoupons.appliedAt));
}

export async function applyCoupon(readerId: number, couponId: number, remarks?: string) {
  const user = await requireAppUser();

  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, couponId));
  if (!coupon || !coupon.active) throw new Error("Coupon not found or inactive.");

  const discountAmount = Number(coupon.discountAmount);

  if (coupon.totalBudget != null) {
    const [{ used }] = await db
      .select({ used: sql<string>`coalesce(sum(${readerCoupons.appliedAmount}), 0)` })
      .from(readerCoupons)
      .where(eq(readerCoupons.couponId, couponId));
    if (Number(used) + discountAmount > Number(coupon.totalBudget)) {
      const remaining = Number(coupon.totalBudget) - Number(used);
      throw new Error(
        `This coupon's budget is exhausted — only ₹${Math.max(0, remaining).toFixed(2)} of ₹${coupon.totalBudget} left.`
      );
    }
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(readerCoupons)
      .values({
        couponId,
        readerId,
        appliedAmount: coupon.discountAmount,
        appliedBy: user.id,
        remarks,
      })
      .returning({ id: readerCoupons.id });

    await postLedgerEntry(
      {
        readerId,
        entryType: "coupon_discount",
        amount: -discountAmount,
        referenceId: inserted.id,
        description: `Coupon ${coupon.code} applied`,
        createdBy: user.id,
      },
      tx
    );

    return { id: inserted.id };
  });
}

// Coupon Tracking page: every coupon with its full usage history (which
// reader, how much, applied by whom, when) plus a running total and
// remaining budget — the same total-used figure applyCoupon() checks
// against, so this always agrees with what would/wouldn't be allowed.
export async function listCouponUsage() {
  await requireAdmin();

  const [allCoupons, usageRows] = await Promise.all([
    db.select().from(coupons).orderBy(asc(coupons.code)),
    db
      .select({
        id: readerCoupons.id,
        couponId: readerCoupons.couponId,
        readerId: readerCoupons.readerId,
        readerName: readers.name,
        readerCode: readers.readerCode,
        appliedAmount: readerCoupons.appliedAmount,
        appliedAt: readerCoupons.appliedAt,
        appliedByName: appUsers.name,
        remarks: readerCoupons.remarks,
      })
      .from(readerCoupons)
      .innerJoin(readers, eq(readerCoupons.readerId, readers.id))
      .innerJoin(appUsers, eq(readerCoupons.appliedBy, appUsers.id))
      .orderBy(desc(readerCoupons.appliedAt)),
  ]);

  return allCoupons.map((c) => {
    const usages = usageRows.filter((u) => u.couponId === c.id);
    const totalUsed = usages.reduce((sum, u) => sum + Number(u.appliedAmount), 0);
    const totalBudget = c.totalBudget != null ? Number(c.totalBudget) : null;
    return {
      id: c.id,
      code: c.code,
      description: c.description,
      discountAmount: c.discountAmount,
      active: c.active,
      totalBudget,
      usageCount: usages.length,
      totalUsed,
      remaining: totalBudget != null ? totalBudget - totalUsed : null,
      usages,
    };
  });
}
