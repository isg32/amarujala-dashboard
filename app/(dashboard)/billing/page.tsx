import { requireAdmin } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CloseMonthForm } from "./close-month-form";

export default async function BillingPage() {
  await requireAdmin();
  const defaultPeriod = new Date().toISOString().slice(0, 7);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Close Month</CardTitle>
        <CardDescription>
          Posts an immutable monthly charge to every eligible reader for the selected period, based
          on their delivery attendance and city pricing. Safe to re-run — readers already closed for
          a period are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CloseMonthForm defaultPeriod={defaultPeriod} />
      </CardContent>
    </Card>
  );
}
