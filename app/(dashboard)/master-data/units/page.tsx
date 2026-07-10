import { requireAdmin } from "@/lib/auth/session";
import { listUnits, listZones } from "@/lib/data/master-data";
import { createUnitAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { UnitRow } from "./unit-row";

export default async function UnitsPage() {
  await requireAdmin();
  const [units, zones] = await Promise.all([listUnits(), listZones()]);

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add Unit</CardTitle>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a Zone first.</p>
          ) : (
            <form action={createUnitAction} className="flex items-end gap-3">
              <FieldGroup className="flex-1">
                <Field>
                  <FieldLabel htmlFor="zoneId">Zone</FieldLabel>
                  <Select
                    name="zoneId"
                    required
                    items={Object.fromEntries(zones.map((z) => [String(z.id), z.name]))}
                  >
                    <SelectTrigger id="zoneId" className="w-full">
                      <SelectValue placeholder="Select a zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={String(zone.id)}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Unit name</FieldLabel>
                  <Input id="name" name="name" required />
                </Field>
              </FieldGroup>
              <Button type="submit">Add</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <UnitRow key={unit.id} unit={unit} zones={zones} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
