import { notFound } from "next/navigation";
import { getReader } from "@/lib/data/readers";
import { listAttendanceForReader } from "@/lib/data/attendance";
import { getCurrentMonthProvisional, listLedgerForReader } from "@/lib/data/billing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LEDGER_LABELS: Record<string, string> = {
  monthly_charge: "Monthly Charge",
  payment: "Payment",
  coupon_discount: "Coupon Discount",
  adjustment: "Adjustment",
};

export default async function ReaderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  const [attendanceRows, provisional, ledgerRows] = await Promise.all([
    listAttendanceForReader(reader.id),
    getCurrentMonthProvisional(reader.id),
    listLedgerForReader(reader.id),
  ]);
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonth = attendanceRows.filter((a) => a.attendanceDate.startsWith(currentMonthPrefix));
  const deliveredCount = thisMonth.filter((a) => a.status === "delivered").length;
  const absentCount = thisMonth.filter((a) => a.status === "not_delivered").length;
  const recentRows = [...attendanceRows].reverse().slice(0, 14);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {reader.name}
            <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{reader.readerCode}</p>
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
          <CardTitle>Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">
            This month: {deliveredCount} delivered, {absentCount} absent
          </p>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance marked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recentRows.map((a) => (
                <Badge key={a.attendanceDate} variant={a.status === "delivered" ? "secondary" : "outline"}>
                  {a.attendanceDate}: {a.status === "delivered" ? "Delivered" : "Absent"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
