"use client";

import { Button } from "@/components/ui/button";

type MonthlyRow = {
  billingPeriod: string;
  periodStart: string;
  periodEnd: string;
  charges: number;
  paid: number;
  discounts: number;
  due: number;
  credit: number;
  delivered: number;
  notDelivered: number;
  notUpdated: number;
  notApplicable: number;
};

function toCsv(rows: MonthlyRow[]): string {
  const header = [
    "Billing Period",
    "Period Start",
    "Period End",
    "Charges",
    "Paid",
    "Discounts & Adjustments",
    "Underpaid (Due)",
    "Overpaid (Credit)",
    "Delivered",
    "Not Delivered",
    "Not Updated",
    "Not Applicable",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(escape).join(",")];
  for (const r of rows) {
    lines.push(
      [r.billingPeriod, r.periodStart, r.periodEnd, r.charges, r.paid, r.discounts, r.due, r.credit, r.delivered, r.notDelivered, r.notUpdated, r.notApplicable]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function ExportCsvButton({
  rows,
  readerName,
  readerCode,
}: {
  rows: MonthlyRow[];
  readerName: string;
  readerCode: string;
}) {
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${readerCode}-${readerName}-ledger.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      Export CSV
    </Button>
  );
}
