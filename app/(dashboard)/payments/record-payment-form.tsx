"use client";

import { useActionState, useState } from "react";
import { recordPaymentAction, type RecordPaymentState } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { ADJUSTMENT_REASON_PRESETS, ADJUSTMENT_REASON_OTHER } from "@/lib/billing/adjustment";

const initialState: RecordPaymentState = null;
const today = new Date().toISOString().slice(0, 10);

export function RecordPaymentForm({ readerId, isAdmin = true, coupons }: { readerId: number; isAdmin?: boolean; coupons?: { id: number; code: string; discountAmount: string }[] }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialState);
  const [method, setMethod] = useState("cash");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>(ADJUSTMENT_REASON_PRESETS[1]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="readerId" value={readerId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="amount">Amount (₹)</FieldLabel>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" />
          {isAdmin && (
            <span className="text-xs text-muted-foreground">Leave blank to post only an adjustment.</span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="method">Method</FieldLabel>
          <Select
            name="method"
            value={method}
            onValueChange={(v) => setMethod(typeof v === "string" ? v : "cash")}
            items={{ cash: "Cash", upi: "UPI", bank_transfer: "Bank Transfer", razorpay: "Razorpay", other: "Other" }}
          >
            <SelectTrigger id="method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {method === "other" && (
          <Field>
            <FieldLabel htmlFor="methodOtherLabel">Method label</FieldLabel>
            <Input id="methodOtherLabel" name="methodOtherLabel" placeholder="e.g. Cheque" />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="transactionReference">Transaction reference (optional)</FieldLabel>
          <Input id="transactionReference" name="transactionReference" />
        </Field>
        <Field>
          <FieldLabel htmlFor="paymentDate">Payment date</FieldLabel>
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={today} max={isAdmin ? undefined : today} required />
          {!isAdmin && <span className="text-xs text-muted-foreground">Only today&apos;s date is available. Contact an Administrator for back-date corrections.</span>}
        </Field>
        {coupons && coupons.length > 0 && (
          <Field>
            <FieldLabel htmlFor="couponId">Coupon / Voucher (optional)</FieldLabel>
            <Select
              name="couponId"
              items={{ "": "None", ...Object.fromEntries(coupons.map((c) => [String(c.id), `${c.code} (₹${c.discountAmount})`])) }}
            >
              <SelectTrigger id="couponId" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="">None</SelectItem>
                  {coupons.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} (₹{c.discountAmount})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
          <Input id="remarks" name="remarks" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="inProcess" value="true" />
          Mark as in-process (pending verification — e.g. cash not yet deposited, cheque not yet cleared)
        </label>

        {isAdmin && (
          <div className="rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={showAdjustment}
                onCheckedChange={(v) => setShowAdjustment(v === true)}
              />
              Add a custom adjustment
            </label>
            {showAdjustment && (
              <div className="mt-3 flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="adjustmentAmount">Adjustment amount (₹)</FieldLabel>
                  <Input id="adjustmentAmount" name="adjustmentAmount" type="number" step="0.01" min="0.01" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="adjustmentDirection">Direction</FieldLabel>
                  <Select name="adjustmentDirection" defaultValue="reduce" items={{ reduce: "Reduce balance (credit)", increase: "Increase balance (charge)" }}>
                    <SelectTrigger id="adjustmentDirection" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="reduce">Reduce balance (credit)</SelectItem>
                        <SelectItem value="increase">Increase balance (charge)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="adjustmentReason">What it&apos;s for</FieldLabel>
                  <Select
                    name="adjustmentReason"
                    value={adjustmentReason}
                    onValueChange={(v) => setAdjustmentReason(typeof v === "string" ? v : ADJUSTMENT_REASON_PRESETS[1])}
                    items={{
                      ...Object.fromEntries(ADJUSTMENT_REASON_PRESETS.map((r) => [r, r])),
                      [ADJUSTMENT_REASON_OTHER]: ADJUSTMENT_REASON_OTHER,
                    }}
                  >
                    <SelectTrigger id="adjustmentReason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ADJUSTMENT_REASON_PRESETS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                        <SelectItem value={ADJUSTMENT_REASON_OTHER}>{ADJUSTMENT_REASON_OTHER}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {adjustmentReason === ADJUSTMENT_REASON_OTHER && (
                  <Field>
                    <FieldLabel htmlFor="adjustmentReasonOther">Describe the adjustment</FieldLabel>
                    <Input id="adjustmentReasonOther" name="adjustmentReasonOther" placeholder="e.g. Refund for missed week" />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}
      </FieldGroup>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Recording..." : "Record Payment"}
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
