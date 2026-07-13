import { requireAdmin } from "@/lib/auth/session";
import { listReadersWithAmountDue } from "@/lib/data/billing";
import { listAssignableCentersWithPocs } from "@/lib/data/readers";
import { formatAmountDue } from "@/lib/billing/format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

// listReadersWithAmountDue computes a live provisional charge for every
// matching reader (unfiltered = the whole org) — still a batched query, but
// worth the same headroom Close Month used to get.
export const maxDuration = 60;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; centerId?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const status = params.status === "due" || params.status === "paid" ? params.status : undefined;

  const [rows, centers] = await Promise.all([
    listReadersWithAmountDue({
      search: params.search || undefined,
      centerId,
      status,
    }),
    listAssignableCentersWithPocs(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Amount Due</CardTitle>
          <CardDescription>
            One row per reader — Amount Due is live (posted balance + today&apos;s unbilled charge), no Close
            Month step needed. A subscription only gets a final ledger charge when it&apos;s actually closed
            (see a reader&apos;s own profile for &quot;Close Subscription&quot;).
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
              <Select
                name="centerId"
                defaultValue={params.centerId || "any"}
                items={{ any: "Any", ...Object.fromEntries(centers.map((c) => [String(c.id), c.name])) }}
              >
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
              <label htmlFor="status" className="text-sm font-medium">Status</label>
              <Select
                name="status"
                defaultValue={params.status || "any"}
                items={{ any: "Any", due: "Due", paid: "Paid / Credit" }}
              >
                <SelectTrigger id="status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="paid">Paid / Credit</SelectItem>
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
                <TableHead>Amount Due</TableHead>
                <TableHead>Last Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.readerId}>
                  <TableCell>
                    {r.readerName}
                    <div className="text-xs text-muted-foreground">{r.readerCode}</div>
                  </TableCell>
                  <TableCell>
                    {r.unitName} / {r.centerName}
                  </TableCell>
                  <TableCell>{r.pocName ?? "—"}</TableCell>
                  <TableCell>{formatAmountDue(r.amountDue)}</TableCell>
                  <TableCell>{r.lastPaymentDate ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No readers found.
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
