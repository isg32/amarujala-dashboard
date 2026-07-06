"use client";

import { useActionState } from "react";
import { createPocAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type Center = { id: number; name: string; cityName: string };

const initialState: { tempPassword: string } | { error: string } | null = null;

export function PocForm({ centers }: { centers: Center[] }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => createPocAction(formData),
    initialState
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field>
            <FieldLabel>Assigned Centers</FieldLabel>
            <div className="flex flex-col gap-2">
              {centers.map((center) => (
                <label key={center.id} className="flex items-center gap-2 text-sm">
                  <Checkbox name="centerIds" value={String(center.id)} />
                  {center.name} ({center.cityName})
                </label>
              ))}
            </div>
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Creating..." : "Create POC"}
        </Button>
      </form>

      {state && "tempPassword" in state && (
        <Alert>
          <AlertTitle>POC account created</AlertTitle>
          <AlertDescription>
            Temporary password (shown once, share with the POC):{" "}
            <code className="font-mono">{state.tempPassword}</code>
          </AlertDescription>
        </Alert>
      )}
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertTitle>Failed to create POC</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
