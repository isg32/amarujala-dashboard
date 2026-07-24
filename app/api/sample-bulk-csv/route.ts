const CSV_HEADERS = [
  "Reader Name",
  "Mobile Number",
  "Complete Address",
  "City",
  "Center",
  "POC",
  "Subscription Start Date",
  "Email",
  "Landmark",
  "Remarks",
];

const SAMPLE_ROW = [
  "Ramesh Kumar",
  "9876543210",
  "123, Main Street, Near Post Office",
  "Delhi",
  "Central",
  "Rajesh POC",
  "2026-07-01",
  "ramesh@example.com",
  "Opposite Metro Station",
  "",
];

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function GET() {
  const rows = [CSV_HEADERS, SAMPLE_ROW];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bulk-upload-sample.csv"',
    },
  });
}
