"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePocAction, deletePocAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "../delete-button";

type Center = { id: number; name: string; cityName: string };
type Poc = {
  id: string;
  name: string;
  email: string;
  centers: { id: number; name: string }[];
  canRecordPayments: boolean;
  canMarkAttendance: boolean;
  canAddReaders: boolean;
  suspended: boolean;
};

export function PocRow({ poc, allCenters }: { poc: Poc; allCenters: Center[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignedIds = new Set(poc.centers.map((c) => c.id));

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{poc.name}</TableCell>
        <TableCell>{poc.email}</TableCell>
        <TableCell className="max-w-3xs whitespace-normal">
          <div className="flex flex-wrap gap-1">
            {poc.centers.map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.name}
              </Badge>
            ))}
            {poc.suspended ? (
              <Badge variant="destructive">Suspended</Badge>
            ) : (
              (!poc.canRecordPayments || !poc.canMarkAttendance || !poc.canAddReaders) && (
                <Badge variant="outline">Restricted</Badge>
              )
            )}
          </div>
        </TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deletePocAction.bind(null, poc.id)}
            confirmMessage={`Delete POC "${poc.name}"? This also removes their login.`}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={4}>
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await updatePocAction(formData);
            setPending(false);
            if (result && "error" in result) {
              setError(result.error);
            } else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={poc.id} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor={`name-${poc.id}`}>
                Name
              </label>
              <Input id={`name-${poc.id}`} name="name" defaultValue={poc.name} className="w-48" required />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Email (not editable)</span>
              <span className="text-sm">{poc.email}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor={`password-${poc.id}`}>
                Reset password (optional)
              </label>
              <Input id={`password-${poc.id}`} name="password" type="password" minLength={8} className="w-40" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Assigned Centers</span>
            <div className="flex flex-col gap-1">
              {allCenters.map((center) => (
                <label key={center.id} className="flex items-center gap-2 text-sm">
                  <Checkbox name="centerIds" value={String(center.id)} defaultChecked={assignedIds.has(center.id)} />
                  {center.name} ({center.cityName})
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Permissions</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="canRecordPayments" defaultChecked={poc.canRecordPayments} />
                Record payments
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="canMarkAttendance" defaultChecked={poc.canMarkAttendance} />
                Mark attendance
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="canAddReaders" defaultChecked={poc.canAddReaders} />
                Add readers
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="suspended" defaultChecked={poc.suspended} />
            Suspended — can still sign in and view everything in their Centers, but can&apos;t record payments, mark
            attendance, add readers, or send reminders
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}
