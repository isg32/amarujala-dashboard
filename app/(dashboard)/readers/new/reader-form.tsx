"use client";

import { useMemo, useState } from "react";
import { createReaderAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Center = { id: number; name: string; cityName: string; pocs: { id: string; name: string }[] };

export function ReaderForm({ centers }: { centers: Center[] }) {
  const [centerId, setCenterId] = useState<string>("");
  const pocOptions = useMemo(
    () => centers.find((c) => String(c.id) === centerId)?.pocs ?? [],
    [centers, centerId]
  );

  return (
    <form action={createReaderAction} className="flex flex-col gap-3 max-w-md">
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
          <Select
            name="centerId"
            required
            value={centerId}
            onValueChange={(v) => setCenterId(typeof v === "string" ? v : "")}
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
        </Field>
        <Field>
          <FieldLabel htmlFor="assignedPocId">Assigned POC (optional)</FieldLabel>
          <Select name="assignedPocId" disabled={pocOptions.length === 0}>
            <SelectTrigger id="assignedPocId" className="w-full">
              <SelectValue placeholder={pocOptions.length === 0 ? "No POC for this center" : "Select a POC"} />
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
      <Button type="submit" className="self-start">Add Reader</Button>
    </form>
  );
}
