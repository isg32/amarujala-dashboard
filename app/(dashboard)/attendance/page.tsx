import { requireAppUser } from "@/lib/auth/session";
import { getReader } from "@/lib/data/readers";
import { listAttendanceForReader } from "@/lib/data/attendance";
import { listCenters, listCities, listUnits } from "@/lib/data/master-data";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AttendanceForm } from "./attendance-form";
import { AttendanceCalendar } from "../readers/[id]/attendance-calendar";
import { ReaderPicker } from "./reader-picker";

// Bulk marking (Center/City/Unit/Org scope, or a wide date range) can touch
// many rows; raise the Server Action timeout above the platform default
// (60s is the max on Vercel's Hobby plan, raise further on Pro).
export const maxDuration = 60;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ readerId?: string }>;
}) {
  const user = await requireAppUser();
  const isAdmin = user.role === "admin";
  const params = await searchParams;

  if (!isAdmin && !user.permissions.canMarkAttendance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Attendance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You don&apos;t have permission to mark attendance. Contact an Administrator.
        </CardContent>
      </Card>
    );
  }

  const [centerRows, cityRows, unitRows] = isAdmin
    ? await Promise.all([listCenters(), listCities(), listUnits()])
    : [[], [], []];

  const selectedReaderId = params.readerId ? Number(params.readerId) : undefined;
  const [selectedReader, calendarAttendance] = selectedReaderId
    ? await Promise.all([getReader(selectedReaderId), listAttendanceForReader(selectedReaderId)])
    : [null, []];

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Card>
        <CardHeader>
          <CardTitle>Quick Mark (Calendar)</CardTitle>
          <CardDescription>Pick a reader and click any day to toggle it between Delivered and Undelivered.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ReaderPicker
            selectedReaderLabel={selectedReader ? `${selectedReader.name} (${selectedReader.readerCode})` : undefined}
          />

          {selectedReaderId && !selectedReader && (
            <p className="text-sm text-muted-foreground">Reader not found, or outside your assigned Centers.</p>
          )}
          {selectedReader && (
            <AttendanceCalendar
              readerId={selectedReader.id}
              attendance={calendarAttendance}
              subscriptionStartDate={selectedReader.subscriptionStartDate}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk / Date-range Mark</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceForm
            isAdmin={isAdmin}
            centerOptions={centerRows.map((c) => ({ id: c.id, label: `${c.name} (${c.cityName})` }))}
            cityOptions={cityRows.map((c) => ({ id: c.id, label: `${c.name} (${c.unitName})` }))}
            unitOptions={unitRows.map((u) => ({ id: u.id, label: `${u.name} (${u.zoneName})` }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
