"use client";

import { useActionState } from "react";
import { closeMonthAction, type CloseMonthState } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const initialState: CloseMonthState = null;

export function CloseMonthForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, formAction, pending] = useActionState(closeMonthAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex items-end gap-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="billingPeriod">Billing period</FieldLabel>
            <Input id="billingPeriod" name="billingPeriod" type="month" defaultValue={defaultPeriod} required />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={pending}>
          {pending ? "Closing..." : "Close Month"}
        </Button>
      </form>

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
    </div>
  );
}
