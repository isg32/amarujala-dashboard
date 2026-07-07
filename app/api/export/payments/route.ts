import { requireAdmin } from "@/lib/auth/session";
import { listPaymentTransactions, type PaymentMethod } from "@/lib/data/payments";
import { buildExportResponse } from "@/lib/export/to-excel";

const METHODS = ["cash", "upi", "bank_transfer", "razorpay", "other"];

export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "xlsx";
  const method = params.get("method");

  const rows = await listPaymentTransactions({
    search: params.get("search") || undefined,
    dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined,
    centerId: params.get("centerId") ? Number(params.get("centerId")) : undefined,
    method: method && METHODS.includes(method) ? (method as PaymentMethod) : undefined,
  });

  const exportRows = rows.map((t) => ({
    Date: t.paymentDate,
    "Reader ID": t.readerCode,
    Reader: t.readerName,
    City: t.cityName,
    Center: t.centerName,
    Method: t.method,
    Reference: t.transactionReference ?? "",
    Amount: t.amount,
  }));

  return buildExportResponse(exportRows, "payments", format);
}
