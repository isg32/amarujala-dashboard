import { requireAdmin } from "@/lib/auth/session";
import { listCenters, listCities } from "@/lib/data/master-data";
import { createCenterAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { CenterRow } from "./center-row";

export default async function CentersPage() {
  await requireAdmin();
  const [centers, cities] = await Promise.all([listCenters(), listCities()]);

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add Center</CardTitle>
        </CardHeader>
        <CardContent>
          {cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a City first.</p>
          ) : (
            <form action={createCenterAction} className="flex flex-col gap-3">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cityId">City</FieldLabel>
                  <Select
                    name="cityId"
                    required
                    items={Object.fromEntries(cities.map((c) => [String(c.id), `${c.name} (${c.unitName})`]))}
                  >
                    <SelectTrigger id="cityId" className="w-full">
                      <SelectValue placeholder="Select a city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={String(city.id)}>
                            {city.name} ({city.unitName})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Center name</FieldLabel>
                  <Input id="name" name="name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="address">Address (optional)</FieldLabel>
                  <Input id="address" name="address" />
                </Field>
              </FieldGroup>
              <Button type="submit" className="self-start">Add</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map((center) => (
                <CenterRow key={center.id} center={center} cities={cities} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
