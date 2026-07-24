import * as XLSX from "xlsx";
import { readerBulkRowSchema, type ReaderBulkRow } from "@/lib/validation/reader";

// Maps the many reasonable header spellings a business user might type in
// Excel to our schema's field names. Matching is case/space-insensitive.
const HEADER_ALIASES: Record<string, keyof ReaderBulkRow> = {
  readername: "name",
  name: "name",
  mobilenumber: "mobile",
  mobile: "mobile",
  email: "email",
  address: "address",
  completeaddress: "address",
  landmark: "landmark",
  city: "city",
  center: "center",
  centre: "center",
  poc: "poc",
  pocname: "poc",
  subscriptionstartdate: "subscriptionStartDate",
  remarks: "remarks",
};

function normalizeHeader(header: string): keyof ReaderBulkRow | null {
  const key = header.toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").trim();
}

export type ParsedReaderRow =
  | { row: number; raw: Record<string, unknown>; data: ReaderBulkRow }
  | { row: number; raw: Record<string, unknown>; error: string };

export function parseReadersFile(buffer: Buffer): ParsedReaderRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rawRows.map((rawRow, index) => {
    const row = index + 2; // +1 for header row, +1 for 1-indexing
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(rawRow)) {
      const field = normalizeHeader(header);
      if (field) mapped[field] = field === "subscriptionStartDate" ? normalizeDate(value) : String(value ?? "").trim();
    }

    const result = readerBulkRowSchema.safeParse(mapped);
    if (!result.success) {
      const reason = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { row, raw: rawRow, error: reason };
    }
    return { row, raw: rawRow, data: result.data };
  });
}
