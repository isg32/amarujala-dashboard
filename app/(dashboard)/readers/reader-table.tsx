"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { bulkDeleteReadersAction, bulkTransferReadersAction, bulkUpdateReaderStatusAction, bulkUpdateReaderLandmarkAction } from "./actions";
import { sendBulkPaymentLinksAction, type BulkSendResult } from "../payments/actions";

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

type Center = { id: number; name: string; cityName: string };

export function ReaderTable({ readers, isAdmin, centers = [] }: { readers: Reader[]; isAdmin: boolean; centers?: Center[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<BulkSendResult | null>(null);
  const [bulkCenterId, setBulkCenterId] = useState("");
  const [bulkLandmark, setBulkLandmark] = useState("");

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
    setLinkResult(null);
    startTransition(async () => {
      const result = await sendBulkPaymentLinksAction([...selected]);
      setLinkResult(result);
      setSelected(new Set());
    });
  }

  function runBulkTransfer() {
    if (!bulkCenterId) return;
    setNotice(null);
    startTransition(async () => {
      const result = await bulkTransferReadersAction([...selected], Number(bulkCenterId));
      setNotice(result.message);
      setSelected(new Set());
      setBulkCenterId("");
      router.refresh();
    });
  }

  function runBulkStatus(status: "active" | "inactive") {
    setNotice(null);
    startTransition(async () => {
      const result = await bulkUpdateReaderStatusAction([...selected], status);
      setNotice(result.message);
      setSelected(new Set());
      router.refresh();
    });
  }

  function runBulkLandmark() {
    if (!bulkLandmark.trim()) return;
    setNotice(null);
    startTransition(async () => {
      const result = await bulkUpdateReaderLandmarkAction([...selected], bulkLandmark.trim());
      setNotice(result.message);
      setSelected(new Set());
      setBulkLandmark("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/attendance" prefetch={false} />} nativeButton={false}>
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

      {isAdmin && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <span className="text-xs text-muted-foreground">Bulk edit {selected.size} selected:</span>
          <Select value={bulkCenterId} onValueChange={(v) => setBulkCenterId(v ?? "")} items={Object.fromEntries(centers.map((c) => [String(c.id), c.name]))}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Transfer to Center..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.cityName})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="xs" disabled={!bulkCenterId || pending} onClick={runBulkTransfer}>
            Go
          </Button>

          <Button variant="outline" size="xs" disabled={pending} onClick={() => runBulkStatus("active")}>
            Set Active
          </Button>
          <Button variant="outline" size="xs" disabled={pending} onClick={() => runBulkStatus("inactive")}>
            Set Inactive
          </Button>

          <Input
            value={bulkLandmark}
            onChange={(e) => setBulkLandmark(e.target.value)}
            placeholder="Set landmark..."
            className="h-8 w-40 text-xs"
          />
          <Button variant="outline" size="xs" disabled={!bulkLandmark.trim() || pending} onClick={runBulkLandmark}>
            Go
          </Button>
        </div>
      )}

      {linkResult && (
        <div className="flex flex-col gap-1 rounded-md border p-2 text-xs">
          <span className={linkResult.failed > 0 ? "text-destructive" : "text-muted-foreground"}>{linkResult.message}</span>
          {linkResult.failures.length > 0 && (
            <ul className="flex flex-col gap-0.5 pl-4 text-muted-foreground">
              {linkResult.failures.map((f) => (
                <li key={f.readerId} className="list-disc">
                  {f.readerName}: {f.reason}
                </li>
              ))}
            </ul>
          )}
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
                <Link href={`/readers/${reader.id}`} prefetch={false} className="hover:underline">
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
