import { requireAdmin } from "@/lib/auth/session";
import { listCities, listUnits } from "@/lib/data/master-data";
import { createCityAction, deleteCityAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

export default async function CitiesPage() {
  await requireAdmin();
  const [cities, units] = await Promise.all([listCities(), listUnits()]);

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add City</CardTitle>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a Unit first.</p>
          ) : (
            <form action={createCityAction} className="flex items-end gap-3">
              <FieldGroup className="flex-1">
                <Field>
                  <FieldLabel htmlFor="unitId">Unit</FieldLabel>
                  <Select name="unitId" required>
                    <SelectTrigger id="unitId" className="w-full">
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={String(unit.id)}>
                            {unit.name} ({unit.zoneName})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">City name</FieldLabel>
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
          <CardTitle>Cities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => (
                <TableRow key={city.id}>
                  <TableCell>{city.name}</TableCell>
                  <TableCell>{city.unitName}</TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      action={deleteCityAction.bind(null, city.id)}
                      confirmMessage={`Delete city "${city.name}"? This also removes its pricing history.`}
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
