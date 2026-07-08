import { listAssignableCentersWithPocs } from "@/lib/data/readers";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ReaderForm } from "./reader-form";

export default async function NewReaderPage() {
  const centers = await listAssignableCentersWithPocs();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Add Reader</CardTitle>
      </CardHeader>
      <CardContent>
        {centers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Centers available. Ask an Administrator to set one up (or assign you to one).
          </p>
        ) : (
          <ReaderForm centers={centers} />
        )}
      </CardContent>
    </Card>
  );
}
