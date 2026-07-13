import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listPaymentIntents } from "@/lib/data/payments";
import { listBillingCycles } from "@/lib/data/billing";
import { listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { ReversePaymentButton } from "../reverse-payment-button";
import { MarkFailedButton } from "./mark-failed-button";

const STATUS_BADGE: Record<string, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  success: "default",
  failed: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unpaid (Pending)",
  success: "Paid",
  failed: "Failed",
};

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; centerId?: string; dueCenterId?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const status =
    params.status === "pending" || params.status === "success" || params.status === "failed"
      ? params.status
      : undefined;
  const dueCenterId = params.dueCenterId ? Number(params.dueCenterId) : undefined;

  const [intents, dueHistory, centers] = await Promise.all([
    listPaymentIntents({ search: params.search || undefined, status, centerId }),
    listBillingCycles({ centerId: dueCenterId, status: "due" }),
    listAssignableCentersWithPocs(),
  ]);

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Payment History</h1>
        <Button variant="outline" size="sm" render={<Link href="/payments" prefetch={false} />} nativeButton={false}>
          Back to Transactions
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Links</CardTitle>
          <CardDescription>
            Every payment link ever sent, and whether the reader actually paid it. A pending link that&apos;s gone
            stale can be marked Failed; a paid one can be reversed the same way any other payment can.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search" className="text-sm font-medium">
                Search Reader
              </label>
              <Input id="search" name="search" defaultValue={params.search} placeholder="Name, mobile, ID" className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="centerId" className="text-sm font-medium">
                Center
              </label>
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
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <Select
                name="status"
                defaultValue={params.status || "any"}
                items={{ any: "Any", pending: "Unpaid (Pending)", success: "Paid", failed: "Failed" }}
              >
                <SelectTrigger id="status" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="pending">Unpaid (Pending)</SelectItem>
                    <SelectItem value="success">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reader</TableHead>
                <TableHead>Center</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intents.map((intent) => (
                <TableRow key={intent.id}>
                  <TableCell>
                    <Link href={`/readers/${intent.readerId}`} prefetch={false} className="hover:underline">
                      {intent.readerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{intent.readerCode}</div>
                  </TableCell>
                  <TableCell>{intent.centerName}</TableCell>
                  <TableCell>₹{intent.amount}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[intent.status]}>{STATUS_LABEL[intent.status]}</Badge>
                    {intent.payment?.reversed && <Badge variant="outline" className="ml-1">Reversed</Badge>}
                  </TableCell>
                  <TableCell>{intent.createdAt.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{intent.paidAt ? intent.paidAt.toISOString().slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {intent.status === "pending" && <MarkFailedButton intentId={intent.id} />}
                    {intent.status === "success" && intent.payment && !intent.payment.reversed && (
                      <ReversePaymentButton paymentId={intent.payment.id} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {intents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No payment links found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Due History</CardTitle>
          <CardDescription>Readers with an outstanding balance, most recently billed first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input type="hidden" name="search" value={params.search ?? ""} />
            <input type="hidden" name="centerId" value={params.centerId ?? ""} />
            <input type="hidden" name="status" value={params.status ?? ""} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dueCenterId" className="text-sm font-medium">
                Center
              </label>
              <Select
                name="dueCenterId"
                defaultValue={params.dueCenterId || "any"}
                items={{ any: "Any", ...Object.fromEntries(centers.map((c) => [String(c.id), c.name])) }}
              >
                <SelectTrigger id="dueCenterId" className="w-48">
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
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reader</TableHead>
                <TableHead>Unit &amp; Center</TableHead>
                <TableHead>Last Charge</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Billing Period</TableHead>
                <TableHead>Last Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dueHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/readers/${row.readerId}`} prefetch={false} className="hover:underline">
                      {row.readerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.readerCode}</div>
                  </TableCell>
                  <TableCell>
                    {row.unitName} / {row.centerName}
                  </TableCell>
                  <TableCell>₹{row.amount}</TableCell>
                  <TableCell>₹{row.outstandingBalance}</TableCell>
                  <TableCell>{row.billingPeriod}</TableCell>
                  <TableCell>{row.lastPaymentDate ?? "—"}</TableCell>
                </TableRow>
              ))}
              {dueHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No readers currently due.
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
