import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getReader, listTransfersForReader } from "@/lib/data/readers";
import { listAttendanceForReader } from "@/lib/data/attendance";
import { getAmountDue, getCurrentMonthProvisional, listLedgerForReader } from "@/lib/data/billing";
import { listPaymentsForReader } from "@/lib/data/payments";
import { listCoupons, listCouponsForReader } from "@/lib/data/coupons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordPaymentForm } from "../../payments/record-payment-form";
import { ReversePaymentButton } from "../../payments/reverse-payment-button";
import { SendPaymentLinkButton } from "../../payments/send-payment-link-button";
import { AttendanceCalendar } from "./attendance-calendar";
import { ApplyCouponForm } from "../../coupons/apply-coupon-form";
import { SendReminderButton } from "./send-reminder-button";
import { BillingCycleForm } from "./billing-cycle-form";
import { CloseSubscriptionButton } from "./close-subscription-button";
import { ReaderProfileCard } from "./reader-profile-card";
import { formatAmountDue } from "@/lib/billing/format";

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

  const [attendanceRows, provisional, amountDue, ledgerRows, paymentRows, appliedCoupons, availableCoupons, transfers] =
    await Promise.all([
      listAttendanceForReader(reader.id),
      getCurrentMonthProvisional(reader.id),
      getAmountDue(reader.id),
      listLedgerForReader(reader.id),
      listPaymentsForReader(reader.id),
      listCouponsForReader(reader.id),
      listCoupons(),
      listTransfersForReader(reader.id),
    ]);

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <ReaderProfileCard
        reader={reader}
        transfers={transfers}
        isAdmin={isAdmin}
        actions={
          <>
            {!currentUser?.suspended && <SendReminderButton readerId={reader.id} />}
            {!currentUser?.suspended && (
              <SendPaymentLinkButton
                readerId={reader.id}
                outstandingBalance={amountDue.toFixed(2)}
                coupons={availableCoupons}
              />
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/readers/${reader.id}/transfer`} prefetch={false} />}
                nativeButton={false}
              >
                Transfer Center
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Amount Due (live, updates automatically — no Close Month needed): {formatAmountDue(amountDue)}
            <br />
            <span className="text-xs">
              Current cycle ({provisional.cycleStart} – {provisional.cycleEnd}, unbilled): ₹{provisional.amount.toFixed(2)}
            </span>
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 text-sm">
          {isAdmin && <BillingCycleForm readerId={reader.id} billingAnchorDay={reader.billingAnchorDay} />}
          {reader.status === "active" && <CloseSubscriptionButton readerId={reader.id} readerName={reader.name} />}
        </CardContent>
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
                      {entry.entryDate}
                      {entry.billingPeriod ? ` (${entry.billingPeriod})` : ""}
                      {entry.description ? ` — ${entry.description}` : ""}
                    </div>
                  </div>
                  <div className={Number(entry.amount) < 0 ? "text-green-600 dark:text-green-400" : ""}>
                    ₹{Math.abs(Number(entry.amount)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update for Manual Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(isAdmin || currentUser?.permissions.canRecordPayments) && (
            <RecordPaymentForm readerId={reader.id} isAdmin={isAdmin} coupons={availableCoupons.length > 0 ? availableCoupons : undefined} />
          )}
          {paymentRows.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              {paymentRows.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <div>
                    <div className={p.reversed ? "text-muted-foreground line-through" : ""}>
                      {p.paymentDate}
                      {p.inProcess && !p.reversed && (
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          In Process
                        </span>
                      )}
                    </div>
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
          {<ApplyCouponForm readerId={reader.id} coupons={availableCoupons} />}
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
          {appliedCoupons.length === 0 && (
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
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
