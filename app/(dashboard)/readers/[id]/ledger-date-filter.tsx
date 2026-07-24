"use client";

import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LedgerDateFilter({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const f = fd.get("dateFrom") as string;
        const t = fd.get("dateTo") as string;
        const params = new URLSearchParams();
        if (f) params.set("dateFrom", f);
        if (t) params.set("dateTo", t);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="ldf-from">From</label>
        <Input id="ldf-from" name="dateFrom" type="date" defaultValue={dateFrom ?? ""} className="h-7 w-36 text-xs" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="ldf-to">To</label>
        <Input id="ldf-to" name="dateTo" type="date" defaultValue={dateTo ?? ""} className="h-7 w-36 text-xs" />
      </div>
      <Button type="submit" variant="outline" size="xs">Filter</Button>
      {(dateFrom || dateTo) && (
        <Button type="button" variant="ghost" size="xs" onClick={() => router.push(pathname)}>Clear</Button>
      )}
    </form>
  );
}
