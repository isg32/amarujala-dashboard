import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listCouponUsage } from "@/lib/data/coupons";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CouponTrackingPage() {
  await requireAdmin();
  const coupons = await listCouponUsage();

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Coupon Tracking</h1>
        <Button variant="outline" size="sm" render={<Link href="/coupons" prefetch={false} />} nativeButton={false}>
          Back to Coupons
        </Button>
      </div>

      {coupons.map((coupon) => (
        <Card key={coupon.id}>
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {coupon.code}
                {!coupon.active && <Badge variant="outline">Inactive</Badge>}
              </CardTitle>
              <CardDescription>{coupon.description ?? "No description"}</CardDescription>
            </div>
            <div className="text-right text-sm">
              <div>Used {coupon.usageCount} time(s), ₹{coupon.totalUsed.toFixed(2)} given</div>
              <div className="text-muted-foreground">
                {coupon.totalBudget != null
                  ? `₹${coupon.remaining!.toFixed(2)} of ₹${coupon.totalBudget.toFixed(2)} left`
                  : "Unlimited budget"}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {coupon.usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Never used yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reader</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Applied By</TableHead>
                    <TableHead>Applied At</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupon.usages.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link href={`/readers/${u.readerId}`} prefetch={false} className="hover:underline">
                          {u.readerName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{u.readerCode}</div>
                      </TableCell>
                      <TableCell>₹{u.appliedAmount}</TableCell>
                      <TableCell>{u.appliedByName}</TableCell>
                      <TableCell>{u.appliedAt.toISOString().slice(0, 10)}</TableCell>
                      <TableCell>{u.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
      {coupons.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">No coupons yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
