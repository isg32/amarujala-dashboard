"use server";

import { parseReadersFile } from "@/lib/bulk-upload/parse-readers";
import { bulkCreateReaders } from "@/lib/data/readers";

export type BulkUploadState =
  | { insertedCount: number; errors: { row: number; reason: string; raw: Record<string, string> }[] }
  | { formError: string }
  | null;

// Server Actions can only return plain serializable data — xlsx's parsed
// cell values aren't guaranteed to be, so coerce to plain strings (all this
// field is used for: display and the "download failed rows" CSV).
function toPlainStrings(raw: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v == null ? "" : String(v)]));
}

export async function bulkUploadReadersAction(
  _prev: BulkUploadState,
  formData: FormData
): Promise<BulkUploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Please choose an Excel (.xlsx) file to upload." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseReadersFile(buffer);
  if (parsedRows.length === 0) {
    return { formError: "The file has no data rows." };
  }

  const { insertedCount, errors } = await bulkCreateReaders(parsedRows);

  const rawByRow = new Map(parsedRows.map((r) => [r.row, r.raw]));
  return {
    insertedCount,
    errors: errors.map((e) => ({ ...e, raw: toPlainStrings(rawByRow.get(e.row) ?? {}) })),
  };
}
