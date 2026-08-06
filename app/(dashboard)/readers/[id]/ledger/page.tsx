import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getReader, listTransfersForReader } from "@/lib/data/readers";
import { getReaderMonthlyLedger, listLedgerForReader, getAmountDue } from "@/lib/data/billing";
import { listAttendanceForReader } from "@/lib/data/attendance";
import { listPaymentsForReader, listPaymentIntentsForReader } from "@/lib/data/payments";
import { listCouponsForReader } from "@/lib/data/coupons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { formatAmountDue } from "@/lib/billing/format";
import { ExportCsvButton } from "./export-csv-button";
import { PrintButton } from "./print-button";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay",
  payu: "PayU",
  other: "Other",
};

const LEDGER_LABELS: Record<string, string> = {
  monthly_charge: "Monthly Charge",
  payment: "Payment",
  coupon_discount: "Coupon Discount",
  adjustment: "Adjustment",
};

const INTENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  success: "Paid",
  failed: "Failed",
};

function currency(n: number): string {
  return `₹${n.toFixed(2)}`;
}

export default async function ReaderLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  const currentUser = await getCurrentAppUser();
  const isAdmin = currentUser?.role === "admin";

  const [monthlyRows, ledgerRows, paymentRows, couponRows, attendanceRows, transfers, amountDue, intents] =
    await Promise.all([
      getReaderMonthlyLedger(reader.id),
      listLedgerForReader(reader.id),
      listPaymentsForReader(reader.id),
      listCouponsForReader(reader.id),
      listAttendanceForReader(reader.id),
      listTransfersForReader(reader.id),
      getAmountDue(reader.id),
      isAdmin ? listPaymentIntentsForReader(reader.id) : Promise.resolve(null),
    ]);

  const totals = monthlyRows.reduce(
    (acc, r) => {
      acc.charges += r.charges;
      acc.paid += r.paid;
      acc.discounts += r.discounts;
      acc.due += r.due;
      acc.credit += r.credit;
      return acc;
    },
    { charges: 0, paid: 0, discounts: 0, due: 0, credit: 0 }
  );

  // Daily delivery log: every day from subscription start through today.
  const attendanceByDate = new Map(attendanceRows.map((a) => [a.attendanceDate, a.status]));
  const dailyLog: { date: string; status: string }[] = [];
  if (reader.subscriptionStartDate) {
    const today = new Date().toISOString().slice(0, 10);
    const end = today < reader.subscriptionStartDate ? reader.subscriptionStartDate : today;
    const cursor = new Date(reader.subscriptionStartDate + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");
    while (cursor <= endDate) {
      const iso = cursor.toISOString().slice(0, 10);
      dailyLog.push({ date: iso, status: attendanceByDate.get(iso) ?? "not_updated" });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    dailyLog.reverse();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/readers/${reader.id}`} className="text-sm text-muted-foreground hover:underline">
                ← Profile
              </Link>
            </div>
            <CardTitle className="mt-1 flex items-center gap-2">
              {reader.name}
              <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{reader.readerCode} — {reader.cityName} / {reader.centerName} / {reader.pocName ?? "No POC"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PrintButton />
            <ExportCsvButton rows={monthlyRows.map((r) => ({ ...r }))} readerName={reader.name} readerCode={reader.readerCode} />
            <Button variant="outline" size="sm" render={<Link href={`/readers/${reader.id}`} prefetch={false} />} nativeButton={false}>
              Back to Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Total amount due (incl. unbilled)</span>
            <span className={amountDue < 0 ? "text-lg font-semibold text-green-600 dark:text-green-400" : "text-lg font-semibold"}>
              {formatAmountDue(amountDue)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat label="Total Charged" value={currency(totals.charges)} />
        <SummaryStat label="Total Paid" value={currency(totals.paid)} tone="good" />
        <SummaryStat label="Discounts & Adj." value={currency(totals.discounts)} />
        <SummaryStat label="Underpaid (Due)" value={currency(totals.due)} tone={totals.due > 0 ? "bad" : undefined} />
        <SummaryStat label="Overpaid (Credit)" value={currency(totals.credit)} tone={totals.credit > 0 ? "good" : undefined} />
      </div>

      {/* Monthly ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Ledger</CardTitle>
          <p className="text-xs text-muted-foreground">Amount billed, paid, discounted and the resulting under/over payment for each billing period.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Charges</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Discounts</TableHead>
                  <TableHead>Underpaid (Due)</TableHead>
                  <TableHead>Overpaid (Credit)</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Not Delivered</TableHead>
                  <TableHead>Not Updated</TableHead>
                  <TableHead>N/A</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                      No billing history yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlyRows.map((r) => (
                    <TableRow key={r.billingPeriod}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.billingPeriod}
                        {r.isCurrentOpen && (
                          <Badge variant="outline" className="ml-2 text-xs">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.periodStart} → {r.periodEnd}</TableCell>
                      <TableCell>{currency(r.charges)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">{currency(r.paid)}</TableCell>
                      <TableCell>{currency(r.discounts)}</TableCell>
                      <TableCell className={r.due > 0 ? "font-medium text-destructive" : ""}>{r.due > 0 ? currency(r.due) : "—"}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">{r.credit > 0 ? currency(r.credit) : "—"}</TableCell>
                      <TableCell>{r.delivered}</TableCell>
                      <TableCell className="text-destructive">{r.notDelivered > 0 ? r.notDelivered : "—"}</TableCell>
                      <TableCell className="text-amber-600 dark:text-amber-400">{r.notUpdated > 0 ? r.notUpdated : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.notApplicable > 0 ? r.notApplicable : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ledger entries */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <p className="text-xs text-muted-foreground">Every financial event recorded for this reader.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Entry Date</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No ledger entries.</TableCell></TableRow>
                ) : (
                  [...ledgerRows].reverse().map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{LEDGER_LABELS[e.entryType] ?? e.entryType}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{e.entryDate}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{e.billingPeriod ?? "—"}</TableCell>
                      <TableCell className="max-w-60 truncate text-xs text-muted-foreground">{e.description ?? "—"}</TableCell>
                      <TableCell className={Number(e.amount) < 0 ? "text-right text-green-600 dark:text-green-400" : "text-right"}>
                        {Number(e.amount) < 0 ? "-" : ""}₹{Math.abs(Number(e.amount)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <p className="text-xs text-muted-foreground">All payments received, by date and method.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">No payments recorded.</TableCell></TableRow>
                ) : (
                  paymentRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-xs">{p.paymentDate}</TableCell>
                      <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.transactionReference ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.recordedByName ?? "—"}</TableCell>
                      <TableCell>
                        {p.reversed ? (
                          <Badge variant="outline">Reversed</Badge>
                        ) : p.inProcess ? (
                          <Badge variant="secondary">In Process</Badge>
                        ) : (
                          <Badge variant="secondary">Paid</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right ${p.reversed ? "text-muted-foreground line-through" : "text-green-600 dark:text-green-400"}`}>
                        ₹{Number(p.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment links (admin) */}
      {intents && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Links Sent</CardTitle>
            <p className="text-xs text-muted-foreground">PayU/Razorpay links sent to this reader.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No payment links sent.</TableCell></TableRow>
                  ) : (
                    intents.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="whitespace-nowrap text-xs">{i.createdAt.toISOString().slice(0, 10)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.txnId}</TableCell>
                        <TableCell><Badge variant={i.status === "success" ? "secondary" : i.status === "failed" ? "outline" : "secondary"}>{INTENT_STATUS_LABELS[i.status] ?? i.status}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{i.paidAt ? i.paidAt.toISOString().slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(i.amount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupons applied */}
      <Card>
        <CardHeader>
          <CardTitle>Coupons Applied</CardTitle>
          <p className="text-xs text-muted-foreground">Discounts applied to this reader.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Applied At</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couponRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">No coupons applied.</TableCell></TableRow>
                ) : (
                  couponRows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.couponCode}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{c.appliedAt.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="max-w-60 truncate text-xs text-muted-foreground">{c.remarks ?? "—"}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">-₹{Number(c.appliedAmount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Daily delivery log */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Delivery Log</CardTitle>
          <p className="text-xs text-muted-foreground">Day-by-day delivery status from subscription start.</p>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyLog.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground">No attendance recorded.</TableCell></TableRow>
                ) : (
                  dailyLog.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="whitespace-nowrap text-xs">{d.date}</TableCell>
                      <TableCell>
                        {d.status === "delivered" ? (
                          <Badge variant="secondary" className="bg-green-600/15 text-green-700 dark:text-green-400">Delivered</Badge>
                        ) : d.status === "not_delivered" ? (
                          <Badge variant="outline" className="text-destructive">Not Delivered</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Not Updated</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer history */}
      {transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Center Transfer History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">{t.transferredAt.toISOString().slice(0, 10)}</TableCell>
                      <TableCell>{t.fromCenterName}</TableCell>
                      <TableCell>{t.toCenterName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const toneClass =
    tone === "good"
      ? "text-green-600 dark:text-green-400"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}