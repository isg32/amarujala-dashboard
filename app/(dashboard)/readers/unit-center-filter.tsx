"use client";

import { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Unit = { id: number; name: string };
type Center = { id: number; name: string; unitId: number | null };

// Selecting a Unit narrows the Center dropdown to just that unit's centers —
// both still submit as plain "unitId"/"centerId" fields on the surrounding
// GET filter form, this only changes which options are shown.
export function UnitCenterFilter({
  units,
  centers,
  defaultUnitId,
  defaultCenterId,
}: {
  units: Unit[];
  centers: Center[];
  defaultUnitId: string;
  defaultCenterId: string;
}) {
  const [unitId, setUnitId] = useState(defaultUnitId);
  const visibleCenters = unitId === "any" ? centers : centers.filter((c) => String(c.unitId) === unitId);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="unitId" className="text-sm font-medium">Unit</label>
        <Select
          name="unitId"
          value={unitId}
          onValueChange={(v) => setUnitId(v ?? "any")}
          items={{ any: "Any", ...Object.fromEntries(units.map((u) => [String(u.id), u.name])) }}
        >
          <SelectTrigger id="unitId" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="any">Any</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="centerId" className="text-sm font-medium">Center</label>
        <Select
          name="centerId"
          defaultValue={visibleCenters.some((c) => String(c.id) === defaultCenterId) ? defaultCenterId : "any"}
          items={{ any: "Any", ...Object.fromEntries(visibleCenters.map((c) => [String(c.id), c.name])) }}
        >
          <SelectTrigger id="centerId" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="any">Any</SelectItem>
              {visibleCenters.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
