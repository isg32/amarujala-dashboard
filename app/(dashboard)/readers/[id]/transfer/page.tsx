import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getReader, listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TransferForm } from "./transfer-form";

export default async function TransferReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  const centers = await listAssignableCentersWithPocs();
  const otherCenters = centers.filter((c) => c.id !== reader.centerId);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Transfer {reader.name}</CardTitle>
        <CardDescription>
          Currently at {reader.centerName} ({reader.cityName}). All history (attendance, payments,
          coupons) stays with the reader — only the Center assignment changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TransferForm readerId={reader.id} otherCenters={otherCenters} />
      </CardContent>
    </Card>
  );
}
