import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth/session";
import { listReaders, listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

export default async function ReadersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; centerId?: string; newlyAdded?: string }>;
}) {
  const params = await searchParams;
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;

  const [readerRows, centers, currentUser] = await Promise.all([
    listReaders({
      search: params.search || undefined,
      status,
      centerId,
      newlyAdded: params.newlyAdded === "true",
    }),
    listAssignableCentersWithPocs(),
    getCurrentAppUser(),
  ]);

  const exportQuery = new URLSearchParams();
  if (params.search) exportQuery.set("search", params.search);
  if (params.status) exportQuery.set("status", params.status);
  if (params.centerId) exportQuery.set("centerId", params.centerId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reader Directory</h1>
        <div className="flex gap-2">
          {currentUser?.role === "admin" && (
            <Button variant="outline" render={<a href={`/api/export/readers?${exportQuery}`} />} nativeButton={false}>
              Export
            </Button>
          )}
          <Button variant="outline" render={<Link href="/readers/bulk-upload" />} nativeButton={false}>
            Bulk Upload
          </Button>
          <Button render={<Link href="/readers/new" />} nativeButton={false}>
            Add Reader
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search" className="text-sm font-medium">Search</label>
              <Input id="search" name="search" defaultValue={params.search} placeholder="Name, mobile, email, reader ID" className="w-64" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium">Status</label>
              <Select name="status" defaultValue={params.status || "any"}>
                <SelectTrigger id="status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="centerId" className="text-sm font-medium">Center</label>
              <Select name="centerId" defaultValue={params.centerId || "any"}>
                <SelectTrigger id="centerId" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Any</SelectItem>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline">Apply filters</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
              {readerRows.map((reader) => (
                <TableRow key={reader.id}>
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
                    <Badge variant={reader.status === "active" ? "secondary" : "outline"}>
                      {reader.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {readerRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No readers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
