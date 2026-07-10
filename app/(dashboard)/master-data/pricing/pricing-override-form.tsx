"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPricingOverrideAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Option = { id: number; name: string };

export function PricingOverrideForm({ units, centers }: { units: Option[]; centers: Option[] }) {
  const router = useRouter();
  const [scope, setScope] = useState<"global" | "unit" | "center">("unit");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = scope === "unit" ? units : scope === "center" ? centers : [];

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await createPricingOverrideAction(formData);
        setPending(false);
        if (result && "error" in result) setError(result.error);
        else router.refresh();
      }}
      className="flex flex-col gap-3"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="scope">Scope</FieldLabel>
          <Select
            name="scope"
            value={scope}
            onValueChange={(v) => setScope((v as typeof scope) ?? "unit")}
            items={{ global: "Global (org-wide default)", unit: "Unit", center: "Center" }}
          >
            <SelectTrigger id="scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="global">Global (org-wide default)</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="center">Center</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {scope !== "global" && (
          <Field>
            <FieldLabel htmlFor="scopeId">{scope === "unit" ? "Unit" : "Center"}</FieldLabel>
            <Select
              name="scopeId"
              required
              items={Object.fromEntries(options.map((o) => [String(o.id), o.name]))}
            >
              <SelectTrigger id="scopeId" className="w-full">
                <SelectValue placeholder={`Select a ${scope}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="dailyPrice">Daily price (₹)</FieldLabel>
          <Input id="dailyPrice" name="dailyPrice" type="number" step="0.01" min="0.01" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="forDate">Festival / one-day only (optional)</FieldLabel>
          <Input id="forDate" name="forDate" type="date" />
          <p className="text-xs text-muted-foreground">
            Leave blank for an ongoing Day Rate. Set a date for a one-time price hike (e.g. Diwali) that applies only
            on that day, overriding even an ongoing Center/Unit rate.
          </p>
        </Field>
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Adding..." : "Add Day Rate"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
