import * as XLSX from "xlsx";

// Shared by every export route handler — one Excel/CSV writer, admin-only
// callers, filters already applied by the caller's own lib/data query.
export function buildExportResponse(
  rows: Record<string, unknown>[],
  filename: string,
  format: "xlsx" | "csv"
): Response {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const body =
    format === "csv"
      ? XLSX.utils.sheet_to_csv(sheet)
      : (() => {
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, sheet, "Export");
          return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        })();

  const contentType = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}.${format}"`,
    },
  });
}
