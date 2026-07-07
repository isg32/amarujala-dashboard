import { requireAppUser } from "@/lib/auth/session";
import { listReaders } from "@/lib/data/readers";
import { listPaymentTransactions } from "@/lib/data/payments";
import { getPaymentDueReport, getAttendanceReport, getGroupedReport, getMonthlySummaryReport } from "@/lib/data/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const REPORT_TYPES = [
  { value: "reader", label: "Reader Report" },
  { value: "payment_due", label: "Payment Due Report" },
  { value: "collection", label: "Collection Report" },
  { value: "attendance", label: "Attendance Report" },
  { value: "city_wise", label: "City-wise Report" },
  { value: "center_wise", label: "Center-wise Report" },
  { value: "poc_wise", label: "POC-wise Report" },
  { value: "monthly_summary", label: "Monthly Summary" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["value"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const currentUser = await requireAppUser();
  const params = await searchParams;
  const type: ReportType = REPORT_TYPES.some((r) => r.value === params.type) ? (params.type as ReportType) : "reader";
  const dateFrom = params.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const dateTo = params.dateTo || new Date().toISOString().slice(0, 10);

  const exportQuery = new URLSearchParams({ dateFrom, dateTo });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reports</h1>
        {currentUser.role === "admin" && (
          <Button
            variant="outline"
            render={<a href={`/api/export/reports/${type}?${exportQuery}`} />}
            nativeButton={false}
          >
            Export
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="type" className="text-sm font-medium">Report</label>
              <Select name="type" defaultValue={type}>
                <SelectTrigger id="type" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REPORT_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {type === "attendance" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dateFrom" className="text-sm font-medium">From</label>
                  <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dateTo" className="text-sm font-medium">To</label>
                  <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
                </div>
              </>
            )}
            <Button type="submit" variant="outline">Run report</Button>
          </form>
        </CardContent>
      </Card>

      <ReportTable type={type} dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}

async function ReportTable({ type, dateFrom, dateTo }: { type: ReportType; dateFrom: string; dateTo: string }) {
  if (type === "reader") {
    const rows = await listReaders();
    return (
      <ReportCard>
        <TableHeader>
          <TableRow>
            <TableHead>Reader</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Center</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.name} <span className="text-xs text-muted-foreground">({r.readerCode})</span></TableCell>
              <TableCell>{r.mobile}</TableCell>
              <TableCell>{r.cityName}</TableCell>
              <TableCell>{r.centerName}</TableCell>
              <TableCell>{r.status}</TableCell>
              <TableCell>₹{r.outstandingBalance}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ReportCard>
    );
  }

  if (type === "payment_due") {
    const rows = await getPaymentDueReport();
    return (
      <ReportCard>
        <TableHeader>
          <TableRow>
            <TableHead>Reader</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Center</TableHead>
            <TableHead>Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.name} <span className="text-xs text-muted-foreground">({r.readerCode})</span></TableCell>
              <TableCell>{r.mobile}</TableCell>
              <TableCell>{r.cityName}</TableCell>
              <TableCell>{r.centerName}</TableCell>
              <TableCell>₹{r.outstandingBalance}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ReportCard>
    );
  }

  if (type === "collection") {
    const rows = await listPaymentTransactions();
    return (
      <ReportCard>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Reader</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Center</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.paymentDate}</TableCell>
              <TableCell>{t.readerName}</TableCell>
              <TableCell>{t.cityName}</TableCell>
              <TableCell>{t.centerName}</TableCell>
              <TableCell>{t.method}</TableCell>
              <TableCell>₹{t.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ReportCard>
    );
  }

  if (type === "attendance") {
    const rows = await getAttendanceReport(dateFrom, dateTo);
    return (
      <ReportCard>
        <TableHeader>
          <TableRow>
            <TableHead>Reader</TableHead>
            <TableHead>Center</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead>Absent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.name} <span className="text-xs text-muted-foreground">({r.readerCode})</span></TableCell>
              <TableCell>{r.centerName}</TableCell>
              <TableCell>{r.delivered}</TableCell>
              <TableCell>{r.absent}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ReportCard>
    );
  }

  if (type === "monthly_summary") {
    const rows = await getMonthlySummaryReport();
    return (
      <ReportCard>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Charges</TableHead>
            <TableHead>Payments Collected</TableHead>
            <TableHead>Coupon Discounts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.month}>
              <TableCell>{r.month}</TableCell>
              <TableCell>₹{r.charges.toFixed(2)}</TableCell>
              <TableCell>₹{r.payments.toFixed(2)}</TableCell>
              <TableCell>₹{r.discounts.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ReportCard>
    );
  }

  const groupBy = type === "city_wise" ? "city" : type === "center_wise" ? "center" : "poc";
  const rows = await getGroupedReport(groupBy);
  return (
    <ReportCard>
      <TableHeader>
        <TableRow>
          <TableHead>{groupBy === "city" ? "City" : groupBy === "center" ? "Center" : "POC"}</TableHead>
          <TableHead>Readers</TableHead>
          <TableHead>Total Collections</TableHead>
          <TableHead>Outstanding Dues</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell>{r.label}</TableCell>
            <TableCell>{r.readerCount}</TableCell>
            <TableCell>₹{r.totalCollections.toFixed(2)}</TableCell>
            <TableCell>₹{r.outstandingDues.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ReportCard>
  );
}

function ReportCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Table>{children}</Table>
      </CardContent>
    </Card>
  );
}
