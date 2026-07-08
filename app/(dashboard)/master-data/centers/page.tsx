import { requireAdmin } from "@/lib/auth/session";
import { listCenters, listCities } from "@/lib/data/master-data";
import { createCenterAction, deleteCenterAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

export default async function CentersPage() {
  await requireAdmin();
  const [centers, cities] = await Promise.all([listCenters(), listCities()]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
                  <Select name="cityId" required>
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
                <TableRow key={center.id}>
                  <TableCell>{center.name}</TableCell>
                  <TableCell>{center.cityName}</TableCell>
                  <TableCell>{center.address}</TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      action={deleteCenterAction.bind(null, center.id)}
                      confirmMessage={`Delete center "${center.name}"?`}
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
