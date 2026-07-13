import { getDashboardKpis } from "@/lib/data/reports";
import { Card, CardContent } from "@/components/ui/card";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardHome() {
  const kpis = await getDashboardKpis();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Readers</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Total" value={kpis.readers.total} />
          <Tile label="Active" value={kpis.readers.active} />
          <Tile label="Inactive" value={kpis.readers.inactive} />
          <Tile label="New (30d)" value={kpis.readers.newLast30Days} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Payments</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Total Collections" value={`₹${kpis.payments.totalCollections.toFixed(2)}`} />
          <Tile label="Outstanding Dues" value={`₹${kpis.payments.outstandingDues.toFixed(2)}`} />
          <Tile label="Today" value={`₹${kpis.payments.today.toFixed(2)}`} />
          <Tile label="This Month" value={`₹${kpis.payments.thisMonth.toFixed(2)}`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Delivery</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Delivered Today" value={kpis.delivery.deliveredToday} />
          <Tile label="Undelivered Today" value={kpis.delivery.absentToday} />
          <Tile label="Monthly Delivery %" value={`${kpis.delivery.monthlyDeliveryPercent}%`} />
        </div>
      </section>

      {kpis.readers.byCity.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Readers by City</h2>
          <div className="flex flex-wrap gap-3">
            {kpis.readers.byCity.map((row) => (
              <Card key={row.label}>
                <CardContent className="flex items-center gap-2 py-3">
                  <span className="text-sm">{row.label}</span>
                  <span className="font-semibold">{row.n}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
