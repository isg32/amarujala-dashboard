import { requireAdmin } from "@/lib/auth/session";
import { listZones } from "@/lib/data/master-data";
import { createZoneAction, deleteZoneAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../delete-button";

export default async function ZonesPage() {
  await requireAdmin();
  const zones = await listZones();

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createZoneAction} className="flex items-end gap-3">
            <FieldGroup className="flex-1">
              <Field>
                <FieldLabel htmlFor="name">Zone name</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
            </FieldGroup>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell>{zone.name}</TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      action={deleteZoneAction.bind(null, zone.id)}
                      confirmMessage={`Delete zone "${zone.name}"?`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
