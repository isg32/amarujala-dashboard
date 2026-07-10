"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCenterAction, deleteCenterAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

type Center = { id: number; name: string; address: string | null; cityId: number; cityName: string };
type City = { id: number; name: string; unitName: string };

export function CenterRow({ center, cities }: { center: Center; cities: City[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{center.name}</TableCell>
        <TableCell>{center.cityName}</TableCell>
        <TableCell>{center.address}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deleteCenterAction.bind(null, center.id)}
            confirmMessage={`Delete center "${center.name}"?`}
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
            const result = await updateCenterAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={center.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`name-${center.id}`}>
              Center name
            </label>
            <Input id={`name-${center.id}`} name="name" defaultValue={center.name} className="w-40" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`cityId-${center.id}`}>
              City
            </label>
            <Select
              name="cityId"
              defaultValue={String(center.cityId)}
              items={Object.fromEntries(cities.map((c) => [String(c.id), `${c.name} (${c.unitName})`]))}
            >
              <SelectTrigger id={`cityId-${center.id}`} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.unitName})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`address-${center.id}`}>
              Address
            </label>
            <Input id={`address-${center.id}`} name="address" defaultValue={center.address ?? ""} className="w-48" />
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
