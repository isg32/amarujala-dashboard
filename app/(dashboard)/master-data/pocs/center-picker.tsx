"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Center = { id: number; name: string; cityId: number; cityName: string };
type City = { id: number; name: string };

// Centers live under Cities, so picking a City bulk-adds every center in it
// as a removable badge — the admin then removes just the exceptions instead
// of hand-checking a long flat center list. Individual centers can still be
// added/removed one at a time. Submits as repeated hidden inputs under the
// same field name, same as the checkbox list this replaces (formData.getAll
// on the server is unchanged).
export function CenterPicker({
  centers,
  cities,
  fieldName = "centerIds",
  defaultSelectedIds = [],
}: {
  centers: Center[];
  cities: City[];
  fieldName?: string;
  defaultSelectedIds?: number[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(defaultSelectedIds));

  function addCity(cityId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of centers) if (c.cityId === cityId) next.add(c.id);
      return next;
    });
  }

  function addCenter(centerId: number) {
    setSelected((prev) => new Set(prev).add(centerId));
  }

  function remove(centerId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(centerId);
      return next;
    });
  }

  const selectedCenters = centers.filter((c) => selected.has(c.id));
  const unselectedCenters = centers.filter((c) => !selected.has(c.id));

  return (
    <div className="flex flex-col gap-2">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={fieldName} value={id} />
      ))}

      <div className="flex flex-wrap gap-2">
        <Select value="" onValueChange={(v) => v && addCity(Number(v))} items={Object.fromEntries(cities.map((c) => [String(c.id), c.name]))}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Add all centers in a city..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {cities.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value=""
          onValueChange={(v) => v && addCenter(Number(v))}
          items={Object.fromEntries(unselectedCenters.map((c) => [String(c.id), `${c.name} (${c.cityName})`]))}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Add one center..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {unselectedCenters.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name} ({c.cityName})
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {selectedCenters.length === 0 && <span className="text-xs text-muted-foreground">No centers assigned yet.</span>}
        {selectedCenters.map((c) => (
          <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
            {c.name} ({c.cityName})
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`Remove ${c.name}`}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
