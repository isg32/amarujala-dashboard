import { requireAdmin } from "@/lib/auth/session";
import { listCityPricing, listCities } from "@/lib/data/master-data";
import { setCityPriceAction, deleteCityPricingAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { DeleteButton } from "../delete-button";

export default async function PricingPage() {
  await requireAdmin();
  const [pricing, cities] = await Promise.all([listCityPricing(), listCities()]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Set City Price</CardTitle>
        </CardHeader>
        <CardContent>
          {cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a City first.</p>
          ) : (
            <form action={setCityPriceAction} className="flex flex-col gap-3">
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
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="price">Monthly price (₹)</FieldLabel>
                  <Input id="price" name="price" type="number" step="0.01" min="0" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="effectiveFrom">Effective from</FieldLabel>
                  <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
                </Field>
              </FieldGroup>
              <Button type="submit" className="self-start">Set price</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.cityName}</TableCell>
                  <TableCell>₹{row.price}</TableCell>
                  <TableCell>{row.effectiveFrom}</TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      action={deleteCityPricingAction.bind(null, row.id)}
                      confirmMessage={`Delete this ₹${row.price} price entry for ${row.cityName}? Past billing already computed with it is unaffected.`}
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
