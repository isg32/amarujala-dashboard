"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdminAction, deleteAdminAction, grantAdminAccessAction, resetAdminPasswordAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../delete-button";

type Admin = { id: string; name: string; email: string };

export function AdminRow({
  admin,
  isSelf,
  canManageAdminPasswords,
}: {
  admin: Admin;
  isSelf: boolean;
  canManageAdminPasswords: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{admin.name}</TableCell>
        <TableCell>{admin.email}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={grantAdminAccessAction.bind(null, admin.id)}
            confirmMessage={`Grant "${admin.name}" the same admin access level as you (lets them create/delete other admins and POCs)?`}
            label="Grant Admin Access"
            pendingLabel="Granting..."
          />
          {isSelf ? (
            <span className="text-xs text-muted-foreground">You</span>
          ) : (
            <DeleteButton
              action={deleteAdminAction.bind(null, admin.id)}
              confirmMessage={`Delete administrator "${admin.name}"? This also removes their login.`}
            />
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={3}>
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await updateAdminAction(formData);
            if (result && "error" in result) {
              setPending(false);
              setError(result.error);
              return;
            }
            const newPassword = formData.get("newPassword");
            if (canManageAdminPasswords && newPassword) {
              const pwResult = await resetAdminPasswordAction(formData);
              if (pwResult && "error" in pwResult) {
                setPending(false);
                setError(pwResult.error);
                return;
              }
            }
            setPending(false);
            setEditing(false);
            router.refresh();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={admin.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`name-${admin.id}`}>
              Name
            </label>
            <Input id={`name-${admin.id}`} name="name" defaultValue={admin.name} className="w-48" required />
          </div>
          <span className="text-xs text-muted-foreground">{admin.email} (not editable)</span>
          {canManageAdminPasswords && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor={`newPassword-${admin.id}`}>
                Reset password (optional)
              </label>
              <Input
                id={`newPassword-${admin.id}`}
                name="newPassword"
                type="password"
                minLength={8}
                placeholder="Leave blank to keep current"
                className="w-40"
              />
            </div>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </form>
      </TableCell>
    </TableRow>
  );
}
