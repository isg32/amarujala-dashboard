import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardHome() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          KPI tiles and reports will appear here.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
