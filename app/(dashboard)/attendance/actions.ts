"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { markAttendanceForReader, bulkMarkAttendance, type BulkScope } from "@/lib/data/attendance";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const statusSchema = z.enum(["delivered", "not_delivered"]);

export type AttendanceActionState = { message: string } | { error: string } | null;

export async function markAttendanceAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const scope = formData.get("scope");
  const dateFrom = dateSchema.parse(formData.get("dateFrom"));
  const dateTo = dateSchema.parse(formData.get("dateTo") || formData.get("dateFrom"));
  const status = statusSchema.parse(formData.get("status"));

  try {
    if (scope === "reader") {
      const readerId = z.coerce.number().int().positive().parse(formData.get("readerId"));
      const { markedDays } = await markAttendanceForReader({ readerId, dateFrom, dateTo, status });
      revalidatePath("/attendance");
      revalidatePath(`/readers/${readerId}`);
      return { message: `Marked ${markedDays} day(s) for this reader.` };
    }

    const bulkScope = z.enum(["center", "city", "unit", "org"]).parse(scope) as BulkScope;
    const scopeId = bulkScope === "org" ? null : z.coerce.number().int().positive().parse(formData.get("scopeId"));
    const { readerCount, dayCount } = await bulkMarkAttendance({ scope: bulkScope, scopeId, dateFrom, dateTo, status });
    revalidatePath("/attendance");
    return { message: `Marked ${dayCount} day(s) for ${readerCount} reader(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to mark attendance." };
  }
}
