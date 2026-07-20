"use client";

import { useActionState, useState } from "react";
import { markAttendanceAction, type AttendanceActionState } from "./actions";
import { ReaderSearchCombobox } from "../readers/reader-search-combobox";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

type Option = { id: number; label: string };

const initialState: AttendanceActionState = null;
const today = new Date().toISOString().slice(0, 10);

export function AttendanceForm({
  isAdmin,
  centerOptions,
  cityOptions,
  unitOptions,
}: {
  isAdmin: boolean;
  centerOptions: Option[];
  cityOptions: Option[];
  unitOptions: Option[];
}) {
  const [state, formAction, pending] = useActionState(markAttendanceAction, initialState);
  const [scope, setScope] = useState<string>("reader");
  const [readerId, setReaderId] = useState<number | null>(null);

  const scopeOptions = [
    { value: "reader", label: "Individual Reader" },
    { value: "center", label: "Center" },
    ...(isAdmin ? [{ value: "city", label: "City" }] : centerOptions.length > 0 ? [{ value: "city", label: "City" }] : []),
    ...(isAdmin ? [{ value: "unit", label: "Unit" }] : unitOptions.length > 0 ? [{ value: "unit", label: "Unit" }] : []),
    ...(isAdmin ? [{ value: "org", label: "Entire Organization" }] : []),
  ];

  const targetOptions: Option[] =
    scope === "center" ? centerOptions : scope === "city" ? cityOptions : scope === "unit" ? unitOptions : [];

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="scope">Scope</FieldLabel>
          <Select
            name="scope"
            value={scope}
            onValueChange={(v) => setScope(typeof v === "string" ? v : "reader")}
            items={Object.fromEntries(scopeOptions.map((o) => [o.value, o.label]))}
          >
            <SelectTrigger id="scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {scopeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {scope === "reader" && (
          <Field>
            <FieldLabel htmlFor="readerSearch">Reader</FieldLabel>
            <ReaderSearchCombobox inputId="readerSearch" onSelect={(r) => setReaderId(r.id)} />
            <input type="hidden" name="readerId" value={readerId ?? ""} />
          </Field>
        )}

        {scope !== "reader" && scope !== "org" && (
          <Field>
            <FieldLabel htmlFor="scopeId">Target</FieldLabel>
            <Select
              name="scopeId"
              required
              items={Object.fromEntries(targetOptions.map((o) => [String(o.id), o.label]))}
            >
              <SelectTrigger id="scopeId" className="w-full">
                <SelectValue placeholder={`Select a ${scope}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {targetOptions.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="dateFrom">Date from</FieldLabel>
          <Input id="dateFrom" name="dateFrom" type="date" required max={isAdmin ? undefined : today} />
          {!isAdmin && <span className="text-xs text-muted-foreground">Only today&apos;s date is available. Contact an Administrator for back-date corrections.</span>}
        </Field>
        <Field>
          <FieldLabel htmlFor="dateTo">Date to (optional, defaults to same day)</FieldLabel>
          <Input id="dateTo" name="dateTo" type="date" max={isAdmin ? undefined : today} />
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select
            name="status"
            defaultValue="delivered"
            items={{ delivered: "Delivered", not_delivered: "Undelivered" }}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="not_delivered">Undelivered</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending || (scope === "reader" && !readerId)} className="self-start">
        {pending ? "Marking..." : "Mark Attendance"}
      </Button>

      {state && "message" in state && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
