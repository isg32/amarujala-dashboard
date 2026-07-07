"use client";

import { useActionState, useState } from "react";
import { recordPaymentAction, type RecordPaymentState } from "./actions";
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

const initialState: RecordPaymentState = null;
const today = new Date().toISOString().slice(0, 10);

export function RecordPaymentForm({ readerId }: { readerId: number }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialState);
  const [method, setMethod] = useState("cash");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="readerId" value={readerId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="amount">Amount (₹)</FieldLabel>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="method">Method</FieldLabel>
          <Select name="method" value={method} onValueChange={(v) => setMethod(typeof v === "string" ? v : "cash")}>
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
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={today} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
          <Input id="remarks" name="remarks" />
        </Field>
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
