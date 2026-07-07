"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createCoupon, deleteCoupon, applyCoupon } from "@/lib/data/coupons";

export async function createCouponAction(formData: FormData) {
  const code = z.string().trim().min(1).parse(formData.get("code"));
  const description = z.string().trim().optional().parse(formData.get("description") || undefined);
  const discountAmount = z.coerce.number().positive().parse(formData.get("discountAmount"));
  await createCoupon(code, description, discountAmount);
  revalidatePath("/coupons");
}

export async function deleteCouponAction(id: number): Promise<{ error: string } | void> {
  try {
    await deleteCoupon(id);
    revalidatePath("/coupons");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete coupon" };
  }
}

export type ApplyCouponState = { message: string } | { error: string } | null;

export async function applyCouponAction(
  _prev: ApplyCouponState,
  formData: FormData
): Promise<ApplyCouponState> {
  const readerId = z.coerce.number().int().positive().parse(formData.get("readerId"));
  const couponId = z.coerce.number().int().positive().parse(formData.get("couponId"));
  const remarks = z.string().trim().optional().parse(formData.get("remarks") || undefined);

  try {
    await applyCoupon(readerId, couponId, remarks);
    revalidatePath(`/readers/${readerId}`);
    return { message: "Coupon applied." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to apply coupon." };
  }
}
