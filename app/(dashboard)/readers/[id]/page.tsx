import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getReader, listTransfersForReader } from "@/lib/data/readers";
import { listAttendanceForReader } from "@/lib/data/attendance";
import { getCurrentMonthProvisional, listLedgerForReader } from "@/lib/data/billing";
import { listPaymentsForReader } from "@/lib/data/payments";
import { listCoupons, listCouponsForReader } from "@/lib/data/coupons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordPaymentForm } from "../../payments/record-payment-form";
import { ReversePaymentButton } from "../../payments/reverse-payment-button";
import { SendPaymentLinkButton } from "../../payments/send-payment-link-button";
import { AttendanceCalendar } from "./attendance-calendar";
import { ApplyCouponForm } from "../../coupons/apply-coupon-form";
import { sendPaymentReminderAction } from "./reminder-actions";

const LEDGER_LABELS: Record<string, string> = {
  monthly_charge: "Monthly Charge",
  payment: "Payment",
  coupon_discount: "Coupon Discount",
  adjustment: "Adjustment",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay",
  payu: "PayU",
  other: "Other",
};

export default async function ReaderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  const currentUser = await getCurrentAppUser();
  const isAdmin = currentUser?.role === "admin";

  const [attendanceRows, provisional, ledgerRows, paymentRows, appliedCoupons, availableCoupons, transfers] =
    await Promise.all([
      listAttendanceForReader(reader.id),
      getCurrentMonthProvisional(reader.id),
      listLedgerForReader(reader.id),
      listPaymentsForReader(reader.id),
      listCouponsForReader(reader.id),
      isAdmin ? listCoupons() : Promise.resolve([]),
      listTransfersForReader(reader.id),
    ]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {reader.name}
              <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{reader.readerCode}</p>
          </div>
          <div className="flex gap-2">
            <form action={sendPaymentReminderAction}>
              <input type="hidden" name="readerId" value={reader.id} />
              <Button type="submit" variant="outline" size="sm">
                Send Payment Reminder
              </Button>
            </form>
            {isAdmin && <SendPaymentLinkButton readerId={reader.id} />}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/readers/${reader.id}/transfer`} />}
                nativeButton={false}
              >
                Transfer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">Mobile</div>
            <div>{reader.mobile}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Email</div>
            <div>{reader.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">City</div>
            <div>{reader.cityName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Center</div>
            <div>{reader.centerName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Assigned POC</div>
            <div>{reader.pocName ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Subscription Start</div>
            <div>{reader.subscriptionStartDate}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Outstanding Balance</div>
            <div>₹{reader.outstandingBalance}</div>
          </div>
        </CardContent>
        {transfers.length > 0 && (
          <CardContent className="border-t pt-4 text-sm">
            <div className="mb-2 text-muted-foreground">Transfer History</div>
            <div className="flex flex-col gap-1.5">
              {transfers.map((t) => (
                <div key={t.id} className="text-xs text-muted-foreground">
                  {t.transferredAt.toISOString().slice(0, 10)}: {t.fromCenterName} → {t.toCenterName}
                  {t.remarks ? ` — ${t.remarks}` : ""}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current month ({provisional.billingPeriod}, provisional): ₹{provisional.amount.toFixed(2)}
          </p>
        </CardHeader>
        <CardContent>
          {ledgerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No billing history yet.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {[...ledgerRows].reverse().map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <div>
                    <div>{LEDGER_LABELS[entry.entryType] ?? entry.entryType}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.billingPeriod ?? entry.createdAt.toISOString().slice(0, 10)}
                      {entry.description ? ` — ${entry.description}` : ""}
                    </div>
                  </div>
                  <div className={Number(entry.amount) < 0 ? "text-primary" : ""}>₹{entry.amount}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RecordPaymentForm readerId={reader.id} />
          {paymentRows.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              {paymentRows.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <div>
                    <div className={p.reversed ? "text-muted-foreground line-through" : ""}>{p.paymentDate}</div>
                    <div className="text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method] ?? p.method}
                      {p.transactionReference ? ` — Ref: ${p.transactionReference}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={p.reversed ? "text-muted-foreground line-through" : ""}>₹{p.amount}</div>
                    {isAdmin && !p.reversed && <ReversePaymentButton paymentId={p.id} />}
                    {p.reversed && <span className="text-xs text-muted-foreground">Reversed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isAdmin && <ApplyCouponForm readerId={reader.id} coupons={availableCoupons} />}
          {appliedCoupons.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              {appliedCoupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <div>
                    <div>{c.couponCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.appliedAt.toISOString().slice(0, 10)}
                      {c.remarks ? ` — ${c.remarks}` : ""}
                    </div>
                  </div>
                  <div>-₹{c.appliedAmount}</div>
                </div>
              ))}
            </div>
          )}
          {appliedCoupons.length === 0 && !isAdmin && (
            <p className="text-sm text-muted-foreground">No coupons applied yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceCalendar
            readerId={reader.id}
            attendance={attendanceRows}
            subscriptionStartDate={reader.subscriptionStartDate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
