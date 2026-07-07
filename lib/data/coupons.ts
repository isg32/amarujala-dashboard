import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { requireAdmin, requireAppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { coupons, readerCoupons, readers } from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { postLedgerEntry } from "@/lib/billing/ledger";

export async function listCoupons() {
  await requireAdmin();
  return db.select().from(coupons).where(eq(coupons.active, true)).orderBy(asc(coupons.code));
}

export async function createCoupon(code: string, description: string | undefined, discountAmount: number) {
  const user = await requireAdmin();
  await db.insert(coupons).values({
    code,
    description,
    discountAmount: discountAmount.toFixed(2),
    createdBy: user.id,
  });
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

// Coupon management (create/assign/apply) is Administrator-only per the FRD.
export async function applyCoupon(readerId: number, couponId: number, remarks?: string) {
  const user = await requireAdmin();

  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, couponId));
  if (!coupon || !coupon.active) throw new Error("Coupon not found or inactive.");

  const discountAmount = Number(coupon.discountAmount);

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
