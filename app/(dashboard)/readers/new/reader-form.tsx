"use client";

import { useActionState, useMemo, useState } from "react";
import { createReaderAction, type CreateReaderState } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Center = { id: number; name: string; cityName: string; pocs: { id: string; name: string }[] };

const initialState: CreateReaderState = null;

export function ReaderForm({ centers }: { centers: Center[] }) {
  const singleCenter = centers.length === 1 ? String(centers[0].id) : "";
  const [centerId, setCenterId] = useState<string>(singleCenter);
  const [state, formAction, pending] = useActionState(createReaderAction, initialState);
  const pocOptions = useMemo(
    () => centers.find((c) => String(c.id) === centerId)?.pocs ?? [],
    [centers, centerId]
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Reader name</FieldLabel>
          <Input id="name" name="name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
          <Input id="mobile" name="mobile" inputMode="numeric" pattern="\d{10}" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email (optional)</FieldLabel>
          <Input id="email" name="email" type="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Input id="address" name="address" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="landmark">Landmark (optional)</FieldLabel>
          <Input id="landmark" name="landmark" />
        </Field>
        <Field>
          <FieldLabel htmlFor="centerId">Center</FieldLabel>
          {centers.length === 1 ? (
            <>
              <input type="hidden" name="centerId" value={singleCenter} />
              <div className="rounded-md border border-input px-2.5 py-1.5 text-sm">{centers[0].name} ({centers[0].cityName})</div>
            </>
          ) : (
            <Select
              name="centerId"
              required
              value={centerId}
              onValueChange={(v) => setCenterId(typeof v === "string" ? v : "")}
              items={Object.fromEntries(centers.map((c) => [String(c.id), `${c.name} (${c.cityName})`]))}
            >
              <SelectTrigger id="centerId" className="w-full">
                <SelectValue placeholder="Select a center" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {centers.map((center) => (
                    <SelectItem key={center.id} value={String(center.id)}>
                      {center.name} ({center.cityName})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="assignedPocId">Assigned POC (optional)</FieldLabel>
          {pocOptions.length <= 1 ? (
            <>
              {pocOptions.length === 1 && <input type="hidden" name="assignedPocId" value={pocOptions[0].id} />}
              <div className="rounded-md border border-input px-2.5 py-1.5 text-sm text-muted-foreground">
                {pocOptions.length === 1 ? pocOptions[0].name : "No POC for this center"}
              </div>
            </>
          ) : (
            <Select
              name="assignedPocId"
              items={Object.fromEntries(pocOptions.map((poc) => [poc.id, poc.name]))}
            >
              <SelectTrigger id="assignedPocId" className="w-full">
                <SelectValue placeholder="Select a POC" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pocOptions.map((poc) => (
                    <SelectItem key={poc.id} value={poc.id}>
                      {poc.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="subscriptionStartDate">Subscription start date</FieldLabel>
          <Input id="subscriptionStartDate" name="subscriptionStartDate" type="date" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
          <Input id="remarks" name="remarks" />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding..." : "Add Reader"}
      </Button>
      {state?.error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to add reader</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
