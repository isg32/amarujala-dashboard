"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCityAction, deleteCityAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

type City = { id: number; name: string; unitId: number; unitName: string };
type Unit = { id: number; name: string; zoneName: string };

export function CityRow({ city, units }: { city: City; units: Unit[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{city.name}</TableCell>
        <TableCell>{city.unitName}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deleteCityAction.bind(null, city.id)}
            confirmMessage={`Delete city "${city.name}"? This also removes its pricing history.`}
          />
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
            const result = await updateCityAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={city.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`name-${city.id}`}>
              City name
            </label>
            <Input id={`name-${city.id}`} name="name" defaultValue={city.name} className="w-40" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`unitId-${city.id}`}>
              Unit
            </label>
            <Select
              name="unitId"
              defaultValue={String(city.unitId)}
              items={Object.fromEntries(units.map((u) => [String(u.id), `${u.name} (${u.zoneName})`]))}
            >
              <SelectTrigger id={`unitId-${city.id}`} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.zoneName})
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
