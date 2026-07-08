import { requireAppUser } from "@/lib/auth/session";
import { listReaders } from "@/lib/data/readers";
import { listCenters, listCities, listUnits } from "@/lib/data/master-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceForm } from "./attendance-form";

// Bulk marking (Center/City/Unit/Org scope, or a wide date range) can touch
// many rows; raise the Server Action timeout above the platform default
// (60s is the max on Vercel's Hobby plan, raise further on Pro).
export const maxDuration = 60;

export default async function AttendancePage() {
  const user = await requireAppUser();
  const isAdmin = user.role === "admin";

  const readerRows = await listReaders();
  const readerOptions = readerRows.map((r) => ({ id: r.id, label: `${r.name} (${r.readerCode})` }));

  const [centerRows, cityRows, unitRows] = isAdmin
    ? await Promise.all([listCenters(), listCities(), listUnits()])
    : [[], [], []];

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Delivery Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <AttendanceForm
          isAdmin={isAdmin}
          readerOptions={readerOptions}
          centerOptions={centerRows.map((c) => ({ id: c.id, label: `${c.name} (${c.cityName})` }))}
          cityOptions={cityRows.map((c) => ({ id: c.id, label: `${c.name} (${c.unitName})` }))}
          unitOptions={unitRows.map((u) => ({ id: u.id, label: `${u.name} (${u.zoneName})` }))}
        />
      </CardContent>
    </Card>
  );
}
