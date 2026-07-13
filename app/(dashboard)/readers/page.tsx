import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth/session";
import { listReadersPaginated, listAssignableCentersWithPocs } from "@/lib/data/readers";
import { listUnits } from "@/lib/data/master-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { ReaderTable } from "./reader-table";
import { UnitCenterFilter } from "./unit-center-filter";

const PAGE_SIZE = 50;

export default async function ReadersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    centerId?: string;
    unitId?: string;
    landmark?: string;
    dueOnly?: string;
    newlyAdded?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const centerId = params.centerId ? Number(params.centerId) : undefined;
  const unitId = params.unitId ? Number(params.unitId) : undefined;
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const dueOnly = params.dueOnly === "true";
  const page = Math.max(1, Number(params.page) || 1);
  const hasFilters = Boolean(
    params.search || params.status || params.centerId || params.unitId || params.landmark || dueOnly || params.newlyAdded === "true"
  );

  const currentUser = await getCurrentAppUser();
  const isAdmin = currentUser?.role === "admin";
  const canAddReaders = isAdmin || currentUser?.permissions.canAddReaders === true;

  const [{ rows: readerRows, total, totalPages }, centers, units] = await Promise.all([
    listReadersPaginated(
      {
        search: params.search || undefined,
        status,
        centerId,
        unitId,
        landmark: params.landmark || undefined,
        dueOnly,
        newlyAdded: params.newlyAdded === "true",
      },
      page,
      PAGE_SIZE
    ),
    listAssignableCentersWithPocs(),
    // listUnits() is requireAdmin()-gated; AU POCs don't get a Unit filter.
    isAdmin ? listUnits() : Promise.resolve([]),
  ]);

  const exportQuery = new URLSearchParams();
  if (params.search) exportQuery.set("search", params.search);
  if (params.status) exportQuery.set("status", params.status);
  if (params.centerId) exportQuery.set("centerId", params.centerId);

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.centerId) query.set("centerId", params.centerId);
    if (params.unitId) query.set("unitId", params.unitId);
    if (params.landmark) query.set("landmark", params.landmark);
    if (params.dueOnly) query.set("dueOnly", params.dueOnly);
    if (params.newlyAdded) query.set("newlyAdded", params.newlyAdded);
    query.set("page", String(targetPage));
    return `/readers?${query}`;
  }

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Reader Directory</h1>
          <p className="text-sm text-muted-foreground">{total} reader{total === 1 ? "" : "s"} found</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" render={<a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/export/readers?${exportQuery}`} />} nativeButton={false}>
              Export
            </Button>
          )}
          {canAddReaders && (
            <>
              <Button variant="outline" render={<Link href="/readers/bulk-upload" prefetch={false} />} nativeButton={false}>
                Bulk Upload
              </Button>
              <Button render={<Link href="/readers/new" prefetch={false} />} nativeButton={false}>
                Add Reader
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search" className="text-sm font-medium">Search</label>
              <Input id="search" name="search" defaultValue={params.search} placeholder="Name, mobile, email, reader ID" className="w-64" />
            </div>
            {isAdmin ? (
              <UnitCenterFilter
                units={units}
                centers={centers}
                defaultUnitId={params.unitId || "any"}
                defaultCenterId={params.centerId || "any"}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="centerId" className="text-sm font-medium">Center</label>
                <Select
                  name="centerId"
                  defaultValue={params.centerId || "any"}
                  items={{ any: "Any", ...Object.fromEntries(centers.map((c) => [String(c.id), c.name])) }}
                >
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
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="landmark" className="text-sm font-medium">Landmark</label>
              <Input id="landmark" name="landmark" defaultValue={params.landmark} placeholder="Any" className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium">Status</label>
              <Select
                name="status"
                defaultValue={params.status || "any"}
                items={{ any: "Any", active: "Active", inactive: "Inactive" }}
              >
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
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox name="dueOnly" value="true" defaultChecked={dueOnly} />
              Show only with due payments
            </label>
            <Button type="submit" variant="outline">Apply filters</Button>
            {hasFilters && (
              <Button variant="outline" render={<Link href="/readers" prefetch={false} />} nativeButton={false}>
                Clear filters
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ReaderTable readers={readerRows} isAdmin={isAdmin} centers={centers} />
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {firstRow}–{lastRow} of {total}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)} prefetch={false} />} nativeButton={false}>
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)} prefetch={false} />} nativeButton={false}>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
