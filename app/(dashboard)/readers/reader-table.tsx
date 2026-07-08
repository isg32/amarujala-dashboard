"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { bulkDeleteReadersAction } from "./actions";
import { sendBulkPaymentLinksAction } from "../payments/actions";

type Reader = {
  id: number;
  name: string;
  readerCode: string;
  mobile: string;
  cityName: string;
  centerName: string;
  pocName: string | null;
  subscriptionStartDate: string;
  outstandingBalance: string;
  status: "active" | "inactive";
};

export function ReaderTable({ readers, isAdmin }: { readers: Reader[]; isAdmin: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const allSelected = readers.length > 0 && selected.size === readers.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(readers.map((r) => r.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulkDelete() {
    if (!confirm(`Delete ${selected.size} reader(s)? Only readers with no attendance/payment history will actually be removed.`)) return;
    setNotice(null);
    startTransition(async () => {
      const result = await bulkDeleteReadersAction([...selected]);
      setNotice(result.message);
      setSelected(new Set());
      router.refresh();
    });
  }

  function runBulkPaymentLinks() {
    setNotice(null);
    startTransition(async () => {
      const result = await sendBulkPaymentLinksAction([...selected]);
      setNotice(result.message);
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/attendance" />} nativeButton={false}>
            Mark Attendance
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selected.size === 0 || pending}
            onClick={runBulkPaymentLinks}
          >
            Send Payment Links{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selected.size === 0 || pending}
            onClick={runBulkDelete}
          >
            Delete Readers{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          {notice && <span className="text-xs text-muted-foreground">{notice}</span>}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {isAdmin && (
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
            )}
            <TableHead>Reader</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Center</TableHead>
            <TableHead>POC</TableHead>
            <TableHead>Subscription Start</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readers.map((reader) => (
            <TableRow key={reader.id}>
              {isAdmin && (
                <TableCell>
                  <Checkbox
                    checked={selected.has(reader.id)}
                    onCheckedChange={() => toggleOne(reader.id)}
                    aria-label={`Select ${reader.name}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <Link href={`/readers/${reader.id}`} className="hover:underline">
                  {reader.name}
                </Link>
                <div className="text-xs text-muted-foreground">{reader.readerCode}</div>
              </TableCell>
              <TableCell>{reader.mobile}</TableCell>
              <TableCell>{reader.cityName}</TableCell>
              <TableCell>{reader.centerName}</TableCell>
              <TableCell>{reader.pocName ?? "—"}</TableCell>
              <TableCell>{reader.subscriptionStartDate}</TableCell>
              <TableCell>₹{reader.outstandingBalance}</TableCell>
              <TableCell>
                <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {readers.length === 0 && (
            <TableRow>
              <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground">
                No readers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
