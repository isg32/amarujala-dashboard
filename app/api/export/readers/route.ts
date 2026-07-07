import { requireAdmin } from "@/lib/auth/session";
import { listReaders } from "@/lib/data/readers";
import { buildExportResponse } from "@/lib/export/to-excel";

// Large exports can take a while to build; raise above the platform
// default (60s is the max on Vercel's Hobby plan, raise further on Pro).
export const maxDuration = 60;

export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "xlsx";

  const rows = await listReaders({
    search: params.get("search") || undefined,
    status: params.get("status") === "active" || params.get("status") === "inactive" ? (params.get("status") as "active" | "inactive") : undefined,
    centerId: params.get("centerId") ? Number(params.get("centerId")) : undefined,
  });

  const exportRows = rows.map((r) => ({
    "Reader ID": r.readerCode,
    Name: r.name,
    Mobile: r.mobile,
    Email: r.email ?? "",
    City: r.cityName,
    Center: r.centerName,
    "Subscription Start": r.subscriptionStartDate,
    "Outstanding Balance": r.outstandingBalance,
    Status: r.status,
  }));

  return buildExportResponse(exportRows, "readers", format);
}
