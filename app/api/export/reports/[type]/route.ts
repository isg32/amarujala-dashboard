import { requireAdmin } from "@/lib/auth/session";
import { listReaders } from "@/lib/data/readers";
import { listPaymentTransactions } from "@/lib/data/payments";
import {
  getPaymentDueReport,
  getAttendanceReport,
  getGroupedReport,
  getMonthlySummaryReport,
} from "@/lib/data/reports";
import { buildExportResponse } from "@/lib/export/to-excel";

export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  await requireAdmin();
  const { type } = await params;
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const centerId = searchParams.get("centerId") ? Number(searchParams.get("centerId")) : undefined;
  const search = searchParams.get("search") || undefined;

  let rows: Record<string, unknown>[];

  switch (type) {
    case "reader": {
      const data = await listReaders({ centerId, search });
      rows = data.map((r) => ({
        "Reader ID": r.readerCode,
        Name: r.name,
        Mobile: r.mobile,
        City: r.cityName,
        Center: r.centerName,
        Status: r.status,
        Outstanding: r.outstandingBalance,
      }));
      break;
    }
    case "payment_due": {
      const data = await getPaymentDueReport({ centerId });
      rows = data.map((r) => ({
        "Reader ID": r.readerCode,
        Name: r.name,
        Mobile: r.mobile,
        City: r.cityName,
        Center: r.centerName,
        Outstanding: r.outstandingBalance,
      }));
      break;
    }
    case "collection": {
      const dateFrom = searchParams.get("dateFrom") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const dateTo = searchParams.get("dateTo") || new Date().toISOString().slice(0, 10);
      const data = await listPaymentTransactions({ centerId, search, dateFrom, dateTo });
      rows = data.map((r) => ({
        Date: r.paymentDate,
        "Reader ID": r.readerCode,
        Name: r.readerName,
        City: r.cityName,
        Center: r.centerName,
        Method: r.method,
        Amount: r.amount,
      }));
      break;
    }
    case "attendance": {
      const dateFrom = searchParams.get("dateFrom") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const dateTo = searchParams.get("dateTo") || new Date().toISOString().slice(0, 10);
      const data = await getAttendanceReport(dateFrom, dateTo, { centerId });
      rows = data.map((r) => ({
        "Reader ID": r.readerCode,
        Name: r.name,
        Center: r.centerName,
        Delivered: r.delivered,
        Absent: r.absent,
      }));
      break;
    }
    case "city_wise":
    case "center_wise":
    case "poc_wise": {
      const groupBy = type === "city_wise" ? "city" : type === "center_wise" ? "center" : "poc";
      const data = await getGroupedReport(groupBy, { centerId });
      rows = data.map((r) => ({
        [groupBy === "city" ? "City" : groupBy === "center" ? "Center" : "POC"]: r.label,
        Readers: r.readerCount,
        "Total Collections": r.totalCollections,
        "Outstanding Dues": r.outstandingDues,
      }));
      break;
    }
    case "monthly_summary": {
      const data = await getMonthlySummaryReport({ centerId });
      rows = data.map((r) => ({
        Month: r.month,
        Charges: r.charges,
        "Payments Collected": r.payments,
        "Coupon Discounts": r.discounts,
      }));
      break;
    }
    default:
      return new Response("Unknown report type", { status: 400 });
  }

  return buildExportResponse(rows, `report-${type}`, format);
}
