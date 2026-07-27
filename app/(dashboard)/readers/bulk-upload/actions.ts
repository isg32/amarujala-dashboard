"use server";

import { z } from "zod";
import { bulkCreateReaders } from "@/lib/data/readers";
import type { ParsedReaderRow } from "@/lib/bulk-upload/parse-readers-client";

export type BulkUploadState =
  | { insertedCount: number; updatedCount: number; errors: { row: number; reason: string; raw: Record<string, string> }[] }
  | { formError: string }
  | null;

export async function bulkUploadReadersAction(
  _prev: BulkUploadState,
  formData: FormData
): Promise<BulkUploadState> {
  const raw = formData.get("parsedRows");
  if (!raw || typeof raw !== "string") {
    return { formError: "No data received. Parse the file on the client first." };
  }

  let parsedRows: ParsedReaderRow[];
  try {
    parsedRows = z.array(z.any()).parse(JSON.parse(raw)) as ParsedReaderRow[];
  } catch {
    return { formError: "Invalid data received." };
  }

  if (parsedRows.length === 0) {
    return { formError: "The file has no data rows." };
  }

  const { insertedCount, updatedCount, errors } = await bulkCreateReaders(parsedRows);

  const rawByRow = new Map(parsedRows.map((r) => [r.row, r.raw]));
  return {
    insertedCount,
    updatedCount,
    errors: errors.map((e) => ({
      ...e,
      raw: Object.fromEntries(Object.entries(rawByRow.get(e.row) ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])),
    })),
  };
}
