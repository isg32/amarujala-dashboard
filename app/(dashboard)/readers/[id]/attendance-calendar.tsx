"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAttendanceAction, markAttendanceRangeAction } from "../../attendance/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthTitle(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Local-time arithmetic, matching toYmd()/monthCursor's local Date
// construction elsewhere in this file — mixing in UTC math here would drift
// by a day around DST/timezone edges.
function addDays(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toYmd(date);
}

type AttendanceRow = { attendanceDate: string; status: "delivered" | "not_delivered" };

export function AttendanceCalendar({
  readerId,
  attendance,
  subscriptionStartDate,
}: {
  readerId: number;
  attendance: AttendanceRow[];
  subscriptionStartDate: string;
}) {
  const router = useRouter();
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [applyPending, setApplyPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byDate = useMemo(() => new Map(attendance.map((a) => [a.attendanceDate, a.status])), [attendance]);
  const todayStr = toYmd(today);

  // Keyboard range selection (Shift+Arrow, spreadsheet-style): anchorDate is
  // where the range started, focusedDate is the moving end. anchorDate ===
  // focusedDate (or null) means no multi-day range is active.
  const [focusedDate, setFocusedDate] = useState(() => (todayStr < subscriptionStartDate ? subscriptionStartDate : todayStr));
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const rangeStart = anchorDate && anchorDate < focusedDate ? anchorDate : (anchorDate ?? focusedDate);
  const rangeEnd = anchorDate && anchorDate > focusedDate ? anchorDate : focusedDate;
  const hasRange = anchorDate != null && anchorDate !== focusedDate;

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = deltas[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = addDays(focusedDate, delta);
    if (next < subscriptionStartDate || next > todayStr) return;
    const [ny, nm] = next.split("-").map(Number);
    if (ny !== monthCursor.getFullYear() || nm !== monthCursor.getMonth() + 1) return; // stay within the rendered month
    setAnchorDate(e.shiftKey ? (anchorDate ?? focusedDate) : null);
    setFocusedDate(next);
  }

  function applyRange(status: "delivered" | "not_delivered") {
    setError(null);
    setApplyPending(true);
    startTransition(async () => {
      const result = await markAttendanceRangeAction(readerId, rangeStart, rangeEnd, status);
      setApplyPending(false);
      if ("error" in result) {
        setError(result.error);
      } else {
        setAnchorDate(null);
        router.refresh();
      }
    });
  }

  const cells = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    const leading = first.getDay();
    const result: (Date | null)[] = Array(leading).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [monthCursor]);

  let deliveredCount = 0;
  let absentCount = 0;
  let unmarkedCount = 0;

  function handleClick(dateStr: string, current: "delivered" | "not_delivered") {
    const next = current === "delivered" ? "not_delivered" : "delivered";
    setError(null);
    setPendingDate(dateStr);
    startTransition(async () => {
      const result = await toggleAttendanceAction(readerId, dateStr, next);
      setPendingDate(null);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          Prev
        </Button>
        <div className="text-sm font-semibold">{monthTitle(monthCursor)}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          Next
        </Button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div
          className="mt-1 grid grid-cols-7 gap-1 outline-none"
          tabIndex={0}
          role="grid"
          aria-label="Attendance calendar — arrow keys to move, Shift+Arrow to select a range"
          onKeyDown={handleGridKeyDown}
        >
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="h-12" />;

            const dateStr = toYmd(date);
            const explicit = byDate.get(dateStr);
            const isFuture = dateStr > todayStr;
            const isBeforeSubscription = dateStr < subscriptionStartDate;
            const disabled = isFuture || isBeforeSubscription;
            const effective: "delivered" | "not_delivered" | undefined = explicit ?? (disabled ? undefined : "delivered");
            const isToday = dateStr === todayStr;
            const isPending = pendingDate === dateStr;
            const isFocused = dateStr === focusedDate;
            const isInRange = hasRange && dateStr >= rangeStart && dateStr <= rangeEnd;

            if (!disabled) {
              if (effective === "not_delivered") absentCount++;
              else deliveredCount++;
              if (!explicit) unmarkedCount++;
            }

            return (
              <button
                key={dateStr}
                type="button"
                data-date={dateStr}
                disabled={disabled || isPending}
                onClick={() => {
                  setFocusedDate(dateStr);
                  setAnchorDate(null);
                  handleClick(dateStr, effective ?? "delivered");
                }}
                title={disabled ? undefined : effective === "not_delivered" ? "Undelivered — click to mark delivered" : "Delivered — click to mark undelivered"}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-md border text-xs transition-colors",
                  disabled && "cursor-not-allowed border-transparent bg-muted/40 text-muted-foreground/50",
                  !disabled && effective === "not_delivered" && "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
                  !disabled && effective === "delivered" && explicit && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400",
                  !disabled && effective === "delivered" && !explicit && "border-border bg-card text-foreground hover:bg-muted",
                  isToday && "ring-2 ring-primary",
                  isInRange && "ring-2 ring-offset-1 ring-blue-500",
                  isFocused && !isInRange && "ring-2 ring-offset-1 ring-foreground/40"
                )}
              >
                <span className="font-medium">{date.getDate()}</span>
                {!disabled && (
                  <span className="text-[10px]">
                    {isPending ? "…" : explicit ? (explicit === "delivered" ? "Delivered" : "Undelivered") : "—"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {hasRange && (
        <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
          <span className="text-muted-foreground">
            {rangeStart} – {rangeEnd} selected — mark as:
          </span>
          <Button type="button" size="xs" disabled={applyPending} onClick={() => applyRange("delivered")}>
            Delivered
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={applyPending} onClick={() => applyRange("not_delivered")}>
            Undelivered
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => setAnchorDate(null)}>
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>Delivered: {deliveredCount}</span>
        <span>Undelivered: {absentCount}</span>
        <span>Unmarked: {unmarkedCount}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Click a day to toggle it between Delivered and Undelivered. Click the grid then use arrow keys to move, or
        Shift+Arrow to select a range and mark it all at once.
      </p>
    </div>
  );
}
