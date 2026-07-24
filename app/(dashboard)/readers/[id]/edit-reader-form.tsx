"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateReaderAction } from "../actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Reader = {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  address: string;
  landmark: string | null;
  subscriptionStartDate: string;
  status: "active" | "inactive";
};

// Deliberately excludes Center — that goes through the dedicated Transfer
// Center flow so the move stays logged to reader_transfers.
export function EditReaderForm({ reader, onDone }: { reader: Reader; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await updateReaderAction(reader.id, formData);
        setPending(false);
        if (result && "error" in result) {
          setError(result.error);
        } else {
          router.refresh();
          onDone();
        }
      }}
      className="flex flex-col gap-3"
    >
      <FieldGroup>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-name">Name</FieldLabel>
            <Input id="edit-name" name="name" defaultValue={reader.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-mobile">Mobile</FieldLabel>
            <Input id="edit-mobile" name="mobile" defaultValue={reader.mobile} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-email">Email</FieldLabel>
            <Input id="edit-email" name="email" type="email" defaultValue={reader.email ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-landmark">Landmark</FieldLabel>
            <Input id="edit-landmark" name="landmark" defaultValue={reader.landmark ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-subscriptionStartDate">Subscription Start Date</FieldLabel>
            <Input id="edit-subscriptionStartDate" name="subscriptionStartDate" type="date" defaultValue={reader.subscriptionStartDate} required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="edit-address">Address</FieldLabel>
          <Input id="edit-address" name="address" defaultValue={reader.address} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-status">Status</FieldLabel>
          <Select name="status" defaultValue={reader.status} items={{ active: "Active", inactive: "Inactive" }}>
            <SelectTrigger id="edit-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  );
}
