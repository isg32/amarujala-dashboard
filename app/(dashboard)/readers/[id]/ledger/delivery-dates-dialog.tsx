"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Kind = "delivered" | "not_delivered" | "not_updated";

const KIND_LABEL: Record<Kind, string> = {
  delivered: "Delivered",
  not_delivered: "Not Delivered",
  not_updated: "Not Updated",
};

const KIND_TRIGGER_CLASS: Record<Kind, string> = {
  delivered: "text-green-600 dark:text-green-400",
  not_delivered: "text-destructive",
  not_updated: "text-amber-600 dark:text-amber-400",
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// One clickable count cell in the Monthly Ledger table. Clicking it opens a
// dialog that lists the exact dates the newspaper was delivered / not
// delivered / not marked in that billing month — the "check the delivery
// history" ask from the field team.
export function DeliveryDatesDialog({
  kind,
  monthLabel,
  dates,
}: {
  kind: Kind;
  monthLabel: string;
  dates: string[];
}) {
  if (dates.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="link" size="xs" className={KIND_TRIGGER_CLASS[kind]} />}
      >
        {dates.length}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {KIND_LABEL[kind]} — {monthLabel}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {dates.length} day{dates.length === 1 ? "" : "s"}
          </p>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {dates.map((d) => (
              <li key={d} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                {formatDate(d)}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
