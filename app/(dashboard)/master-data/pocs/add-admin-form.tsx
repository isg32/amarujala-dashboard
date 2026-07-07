"use client";

import { useActionState } from "react";
import { createAdminAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const initialState: { tempPassword?: string } | { error: string } | null = null;

export function AddAdminForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => createAdminAction(formData),
    initialState
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex items-end gap-3">
        <FieldGroup className="flex-1">
          <Field>
            <FieldLabel htmlFor="admin-name">Name</FieldLabel>
            <Input id="admin-name" name="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="admin-email">Email</FieldLabel>
            <Input id="admin-email" name="email" type="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="admin-password">Password (optional)</FieldLabel>
            <Input id="admin-password" name="password" type="password" minLength={8} />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Admin"}
        </Button>
      </form>

      {state && "tempPassword" in state && (
        <Alert>
          <AlertTitle>Administrator account created</AlertTitle>
          <AlertDescription>
            {state.tempPassword ? (
              <>
                Temporary password (shown once, share with them securely):{" "}
                <code className="font-mono">{state.tempPassword}</code>
              </>
            ) : (
              "They can sign in with the password you set."
            )}
          </AlertDescription>
        </Alert>
      )}
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertTitle>Failed to create admin</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
