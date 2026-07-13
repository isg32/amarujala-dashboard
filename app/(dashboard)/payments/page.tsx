import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth/session";
import { listPaymentTransactions, type PaymentMethod } from "@/lib/data/payments";
import { listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay",
  payu: "PayU",
  other: "Other",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; dateFrom?: string; dateTo?: string; centerId?: string; method?: string }>;
}) {
  const params = await searchParams;
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const method = (["cash", "upi", "bank_transfer", "razorpay", "payu", "other"] as const).includes(
    params.method as PaymentMethod
  )
    ? (params.method as PaymentMethod)
    : undefined;

  const [transactions, centers, currentUser] = await Promise.all([
    listPaymentTransactions({
      search: params.search || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      centerId,
      method,
    }),
    listAssignableCentersWithPocs(),
    getCurrentAppUser(),
  ]);

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const exportQuery = new URLSearchParams();
  if (params.search) exportQuery.set("search", params.search);
  if (params.dateFrom) exportQuery.set("dateFrom", params.dateFrom);
  if (params.dateTo) exportQuery.set("dateTo", params.dateTo);
  if (params.centerId) exportQuery.set("centerId", params.centerId);
  if (params.method) exportQuery.set("method", params.method);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Payment Transactions</h1>
        {currentUser?.role === "admin" && (
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/payments/history" prefetch={false} />} nativeButton={false}>
              Payment History
            </Button>
            <Button variant="outline" render={<a href={`/api/export/payments?${exportQuery}`} />} nativeButton={false}>
              Export
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search" className="text-sm font-medium">Search</label>
              <Input id="search" name="search" defaultValue={params.search} placeholder="Reader name, mobile, ID" className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dateFrom" className="text-sm font-medium">From</label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={params.dateFrom} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dateTo" className="text-sm font-medium">To</label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={params.dateTo} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="centerId" className="text-sm font-medium">Center</label>
              <Select
                name="centerId"
                defaultValue={params.centerId || "any"}
                items={{ any: "Any", ...Object.fromEntries(centers.map((c) => [String(c.id), c.name])) }}
              >
                <SelectTrigger id="centerId" className="w-40">
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
              <label htmlFor="method" className="text-sm font-medium">Method</label>
              <Select
                name="method"
                defaultValue={params.method || "any"}
                items={{ any: "Any", ...METHOD_LABELS }}
              >
                <SelectTrigger id="method" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline">Apply filters</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {transactions.length} transaction(s), total ₹{total.toFixed(2)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reader</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Center</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.paymentDate}</TableCell>
                  <TableCell>
                    <Link href={`/readers/${t.readerId}`} prefetch={false} className="hover:underline">
                      {t.readerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{t.readerCode}</div>
                  </TableCell>
                  <TableCell>{t.cityName}</TableCell>
                  <TableCell>{t.centerName}</TableCell>
                  <TableCell>{METHOD_LABELS[t.method] ?? t.method}</TableCell>
                  <TableCell>{t.transactionReference ?? "—"}</TableCell>
                  <TableCell>₹{t.amount}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions found.
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
