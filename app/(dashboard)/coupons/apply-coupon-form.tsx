"use client";

import { useActionState } from "react";
import { applyCouponAction, type ApplyCouponState } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

type Coupon = { id: number; code: string; discountAmount: string };

const initialState: ApplyCouponState = null;

export function ApplyCouponForm({ readerId, coupons }: { readerId: number; coupons: Coupon[] }) {
  const [state, formAction, pending] = useActionState(applyCouponAction, initialState);

  if (coupons.length === 0) {
    return <p className="text-sm text-muted-foreground">No active coupons. Create one on the Coupons page.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="readerId" value={readerId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="couponId">Coupon</FieldLabel>
          <Select name="couponId" required>
            <SelectTrigger id="couponId" className="w-full">
              <SelectValue placeholder="Select a coupon" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {coupons.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} (₹{c.discountAmount})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
          <Input id="remarks" name="remarks" />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Applying..." : "Apply Coupon"}
      </Button>

      {state && "message" in state && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
