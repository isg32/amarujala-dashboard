"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUnitAction, deleteUnitAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

type Unit = { id: number; name: string; zoneId: number; zoneName: string };
type Zone = { id: number; name: string };

export function UnitRow({ unit, zones }: { unit: Unit; zones: Zone[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{unit.name}</TableCell>
        <TableCell>{unit.zoneName}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton action={deleteUnitAction.bind(null, unit.id)} confirmMessage={`Delete unit "${unit.name}"?`} />
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
            const result = await updateUnitAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={unit.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`name-${unit.id}`}>
              Unit name
            </label>
            <Input id={`name-${unit.id}`} name="name" defaultValue={unit.name} className="w-40" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`zoneId-${unit.id}`}>
              Zone
            </label>
            <Select
              name="zoneId"
              defaultValue={String(unit.zoneId)}
              items={Object.fromEntries(zones.map((z) => [String(z.id), z.name]))}
            >
              <SelectTrigger id={`zoneId-${unit.id}`} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={String(z.id)}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
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
