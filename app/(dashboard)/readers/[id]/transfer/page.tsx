import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getReader, listAssignableCentersWithPocs } from "@/lib/data/readers";
import { transferReaderAction } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

export default async function TransferReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  const centers = await listAssignableCentersWithPocs();
  const otherCenters = centers.filter((c) => c.id !== reader.centerId);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Transfer {reader.name}</CardTitle>
        <CardDescription>
          Currently at {reader.centerName} ({reader.cityName}). All history (attendance, payments,
          coupons) stays with the reader — only the Center assignment changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={transferReaderAction} className="flex flex-col gap-3">
          <input type="hidden" name="readerId" value={reader.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="toCenterId">New Center</FieldLabel>
              <Select
                name="toCenterId"
                required
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
            </Field>
            <Field>
              <FieldLabel htmlFor="remarks">Remarks (optional)</FieldLabel>
              <Input id="remarks" name="remarks" />
            </Field>
          </FieldGroup>
          <Button type="submit" className="self-start">Transfer Center</Button>
        </form>
      </CardContent>
    </Card>
  );
}
