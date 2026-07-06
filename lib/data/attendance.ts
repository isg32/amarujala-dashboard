import "server-only";
import { asc, eq } from "drizzle-orm";
import { requireAdmin, requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attendance, attendanceBulkRuns, readers, centers, cities } from "@/lib/db/schema";

function datesBetween(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(dateFrom + "T00:00:00Z");
  const end = new Date(dateTo + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function assertReaderInScope(user: AppUser, readerId: number) {
  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  if (user.role === "au_poc" && !user.centerIds.includes(reader.centerId)) {
    throw new Error("You cannot mark attendance for a reader outside your assigned Centers.");
  }
}

// Single reader, one or more consecutive days (dateFrom === dateTo for a
// single day). Available to both roles — center-scoped for AU POC.
export async function markAttendanceForReader(input: {
  readerId: number;
  dateFrom: string;
  dateTo: string;
  status: "delivered" | "not_delivered";
}) {
  const user = await requireAppUser();
  await assertReaderInScope(user, input.readerId);

  const dates = datesBetween(input.dateFrom, input.dateTo);
  const rows = dates.map((attendanceDate) => ({
    readerId: input.readerId,
    attendanceDate,
    status: input.status,
    markedBy: user.id,
  }));

  await db
    .insert(attendance)
    .values(rows)
    .onConflictDoUpdate({
      target: [attendance.readerId, attendance.attendanceDate],
      set: { status: input.status, markedBy: user.id },
    });

  return { markedDays: dates.length };
}

export async function listAttendanceForReader(readerId: number) {
  const user = await requireAppUser();
  await assertReaderInScope(user, readerId);

  return db
    .select({ attendanceDate: attendance.attendanceDate, status: attendance.status })
    .from(attendance)
    .where(eq(attendance.readerId, readerId))
    .orderBy(asc(attendance.attendanceDate));
}

export type BulkScope = "center" | "city" | "unit" | "org";

async function resolveReaderIdsForScope(scope: BulkScope, scopeId: number | null): Promise<number[]> {
  let query;
  switch (scope) {
    case "center":
      query = db.select({ id: readers.id }).from(readers).where(eq(readers.centerId, scopeId!));
      break;
    case "city":
      query = db
        .select({ id: readers.id })
        .from(readers)
        .innerJoin(centers, eq(readers.centerId, centers.id))
        .where(eq(centers.cityId, scopeId!));
      break;
    case "unit":
      query = db
        .select({ id: readers.id })
        .from(readers)
        .innerJoin(centers, eq(readers.centerId, centers.id))
        .innerJoin(cities, eq(centers.cityId, cities.id))
        .where(eq(cities.unitId, scopeId!));
      break;
    case "org":
      query = db.select({ id: readers.id }).from(readers);
      break;
  }
  const rows = await query;
  return rows.map((r) => r.id);
}

// Bulk marking by Center/City/Unit/Org is an Administrator-only action per
// the FRD ("Administrators should be able to mark delivery absence in
// bulk") — AU POCs use markAttendanceForReader for their own readers.
export async function bulkMarkAttendance(input: {
  scope: BulkScope;
  scopeId: number | null;
  dateFrom: string;
  dateTo: string;
  status: "delivered" | "not_delivered";
}) {
  const user = await requireAdmin();

  const readerIds = await resolveReaderIdsForScope(input.scope, input.scopeId);
  const dates = datesBetween(input.dateFrom, input.dateTo);

  if (readerIds.length > 0 && dates.length > 0) {
    const rows = readerIds.flatMap((readerId) =>
      dates.map((attendanceDate) => ({
        readerId,
        attendanceDate,
        status: input.status,
        markedBy: user.id,
      }))
    );
    // Postgres has a bound-parameter limit per statement; chunk large batches.
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      await db
        .insert(attendance)
        .values(rows.slice(i, i + CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [attendance.readerId, attendance.attendanceDate],
          set: { status: input.status, markedBy: user.id },
        });
    }
  }

  await db.insert(attendanceBulkRuns).values({
    scope: input.scope,
    scopeId: input.scopeId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    createdBy: user.id,
  });

  return { readerCount: readerIds.length, dayCount: dates.length };
}
