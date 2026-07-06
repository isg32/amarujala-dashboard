"use client";

import { useActionState } from "react";
import { bulkUploadReadersAction, type BulkUploadState } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

function downloadFailedRows(errors: { row: number; reason: string; raw: Record<string, unknown> }[]) {
  const columns = Array.from(new Set(errors.flatMap((e) => Object.keys(e.raw))));
  const header = [...columns, "Error"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    header.map(escape).join(","),
    ...errors.map((e) => [...columns.map((c) => e.raw[c]), e.reason].map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "failed-rows.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const initialState: BulkUploadState = null;

export function BulkUploadForm() {
  const [state, formAction, pending] = useActionState(bulkUploadReadersAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex items-end gap-3">
        <FieldGroup className="flex-1">
          <Field>
            <FieldLabel htmlFor="file">Excel file (.xlsx)</FieldLabel>
            <Input id="file" name="file" type="file" accept=".xlsx,.xls,.csv" required />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading..." : "Upload"}
        </Button>
      </form>

      {state && "formError" in state && (
        <Alert variant="destructive">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {state && "insertedCount" in state && (
        <div className="flex flex-col gap-3">
          <Alert>
            <AlertTitle>{state.insertedCount} reader(s) added</AlertTitle>
            {state.errors.length > 0 && (
              <AlertDescription>{state.errors.length} row(s) were skipped — see below.</AlertDescription>
            )}
          </Alert>

          {state.errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Skipped rows</h3>
                <Button variant="outline" size="sm" onClick={() => downloadFailedRows(state.errors)}>
                  Download failed rows
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.errors.map((e) => (
                    <TableRow key={e.row}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
