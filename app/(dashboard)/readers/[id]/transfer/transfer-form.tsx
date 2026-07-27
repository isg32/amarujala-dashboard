"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { transferReaderAction } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Center = { id: number; name: string; cityName: string; pocs: { id: string; name: string }[] };

export function TransferForm({ readerId, otherCenters }: { readerId: number; otherCenters: Center[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toCenterId, setToCenterId] = useState<string>(otherCenters.length === 1 ? String(otherCenters[0].id) : "");
  const selectedPocs = useMemo(
    () => otherCenters.find((c) => String(c.id) === toCenterId)?.pocs ?? [],
    [otherCenters, toCenterId]
  );

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        try {
          await transferReaderAction(formData);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to transfer reader.");
          setPending(false);
        }
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="readerId" value={readerId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="toCenterId">New Center</FieldLabel>
          {otherCenters.length === 1 ? (
            <>
              <input type="hidden" name="toCenterId" value={String(otherCenters[0].id)} />
              <div className="rounded-md border border-input px-2.5 py-1.5 text-sm">
                {otherCenters[0].name} ({otherCenters[0].cityName})
              </div>
            </>
          ) : (
            <Select
              name="toCenterId"
              required
              value={toCenterId}
              onValueChange={(v) => setToCenterId(typeof v === "string" ? v : "")}
              items={Object.fromEntries(otherCenters.map((c) => [String(c.id), `${c.name} (${c.cityName})`]))}
            >
              <SelectTrigger id="toCenterId" className="w-full">
                <SelectValue placeholder="Select a center" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {otherCenters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.cityName})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="assignPocId">Assign POC (optional)</FieldLabel>
          {selectedPocs.length <= 1 ? (
            <>
              {selectedPocs.length === 1 && <input type="hidden" name="assignedPocId" value={selectedPocs[0].id} />}
              <div className="rounded-md border border-input px-2.5 py-1.5 text-sm text-muted-foreground">
                {selectedPocs.length === 1 ? selectedPocs[0].name : "No POC for this center"}
              </div>
            </>
          ) : (
            <Select name="assignedPocId" items={Object.fromEntries(selectedPocs.map((poc) => [poc.id, poc.name]))}>
              <SelectTrigger id="assignPocId" className="w-full">
                <SelectValue placeholder="Select a POC" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectedPocs.map((poc) => (
                    <SelectItem key={poc.id} value={poc.id}>{poc.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
          <Input id="remarks" name="remarks" />
        </Field>
      </FieldGroup>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Transferring..." : "Transfer Center"}
      </Button>
    </form>
  );
}