import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listAllCoupons } from "@/lib/data/coupons";
import { createCouponAction } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CouponRow } from "./coupon-row";

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await listAllCoupons();

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Coupons</h1>
        <Button variant="outline" size="sm" render={<Link href="/coupons/usage" />} nativeButton={false}>
          Coupon Tracking
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCouponAction} className="flex flex-col gap-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">Code</FieldLabel>
                <Input id="code" name="code" required placeholder="e.g. WELCOME100" />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
                <Input id="description" name="description" />
              </Field>
              <Field>
                <FieldLabel htmlFor="discountAmount">Discount amount (₹)</FieldLabel>
                <Input id="discountAmount" name="discountAmount" type="number" step="0.01" min="0.01" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="totalBudget">Total budget (₹, optional)</FieldLabel>
                <Input id="totalBudget" name="totalBudget" type="number" step="0.01" min="0.01" />
                <p className="text-xs text-muted-foreground">Leave blank for unlimited uses.</p>
              </Field>
            </FieldGroup>
            <Button type="submit" className="self-start">Create Coupon</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <CouponRow key={c.id} coupon={c} />
              ))}
              {coupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No coupons yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
