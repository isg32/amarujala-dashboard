import { requireAdmin } from "@/lib/auth/session";
import { listBillingCycles } from "@/lib/data/billing";
import { listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { CloseMonthForm } from "./close-month-form";

// Closing a month iterates every eligible reader; raise the Server Action
// timeout above the platform default (60s is the max on Vercel's Hobby
// plan, raise further on Pro) for orgs with many readers.
export const maxDuration = 60;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; centerId?: string; billingPeriod?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const defaultPeriod = new Date().toISOString().slice(0, 7);
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const status = params.status === "due" || params.status === "paid" ? params.status : undefined;

  const [cycles, centers] = await Promise.all([
    listBillingCycles({
      search: params.search || undefined,
      centerId,
      billingPeriod: params.billingPeriod || undefined,
      status,
    }),
    listAssignableCentersWithPocs(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Close Month</CardTitle>
          <CardDescription>
            Posts an immutable monthly charge to every eligible reader for the selected period, based
            on their delivery attendance and city pricing. Safe to re-run — readers already closed for
            a period are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CloseMonthForm defaultPeriod={defaultPeriod} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Payment Cycles</CardTitle>
          <CardDescription>
            One row per reader per closed billing period. &quot;Outstanding&quot; is the reader&apos;s
            current overall balance, not specific to this period — payments aren&apos;t tracked per
            cycle in this app, only as a running total (see the reader&apos;s own profile for their
            full ledger history).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search" className="text-sm font-medium">Search Reader</label>
              <Input id="search" name="search" defaultValue={params.search} placeholder="Name, mobile, ID" className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="centerId" className="text-sm font-medium">Center</label>
              <Select name="centerId" defaultValue={params.centerId || "any"}>
                <SelectTrigger id="centerId" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="billingPeriod" className="text-sm font-medium">Billing Month</label>
              <Input id="billingPeriod" name="billingPeriod" type="month" defaultValue={params.billingPeriod} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium">Status</label>
              <Select name="status" defaultValue={params.status || "any"}>
                <SelectTrigger id="status" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline">Apply</Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reader</TableHead>
                <TableHead>Unit &amp; Center</TableHead>
                <TableHead>POC</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Billing Period</TableHead>
                <TableHead>Last Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.readerName}
                    <div className="text-xs text-muted-foreground">{c.readerCode}</div>
                  </TableCell>
                  <TableCell>
                    {c.unitName} / {c.centerName}
                  </TableCell>
                  <TableCell>{c.pocName ?? "—"}</TableCell>
                  <TableCell>₹{c.amount}</TableCell>
                  <TableCell>₹{c.outstandingBalance}</TableCell>
                  <TableCell>{c.billingPeriod}</TableCell>
                  <TableCell>{c.lastPaymentDate ?? "—"}</TableCell>
                </TableRow>
              ))}
              {cycles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No payment cycles found.
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
