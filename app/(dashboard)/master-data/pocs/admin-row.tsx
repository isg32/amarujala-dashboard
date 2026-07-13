"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdminAction, deleteAdminAction, grantAdminAccessAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../delete-button";

type Admin = { id: string; name: string; email: string };

export function AdminRow({ admin, isSelf }: { admin: Admin; isSelf: boolean }) {
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
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
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
