"use client";

import { useActionState } from "react";
import { createPocAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CenterPicker } from "./center-picker";

type Center = { id: number; name: string; cityId: number; cityName: string };
type City = { id: number; name: string };

const initialState: { tempPassword?: string } | { error: string } | null = null;

export function PocForm({ centers, cities }: { centers: Center[]; cities: City[] }) {
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
            <FieldLabel htmlFor="password">Password (optional)</FieldLabel>
            <Input id="password" name="password" type="password" minLength={8} />
            <p className="text-xs text-muted-foreground">Leave blank to auto-generate one.</p>
          </Field>
          <Field>
            <FieldLabel>Assigned Centers</FieldLabel>
            <CenterPicker centers={centers} cities={cities} />
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
            {state.tempPassword ? (
              <>
                Temporary password (shown once, share with the POC):{" "}
                <code className="font-mono">{state.tempPassword}</code>
              </>
            ) : (
              "The POC can sign in with the password you set."
            )}
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
