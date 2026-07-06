import { notFound } from "next/navigation";
import { getReader } from "@/lib/data/readers";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ReaderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reader = await getReader(Number(id));
  if (!reader) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {reader.name}
            <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{reader.readerCode}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">Mobile</div>
            <div>{reader.mobile}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Email</div>
            <div>{reader.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">City</div>
            <div>{reader.cityName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Center</div>
            <div>{reader.centerName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Assigned POC</div>
            <div>{reader.pocName ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Subscription Start</div>
            <div>{reader.subscriptionStartDate}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Outstanding Balance</div>
            <div>₹{reader.outstandingBalance}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
