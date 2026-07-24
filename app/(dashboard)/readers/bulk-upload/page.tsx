import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BulkUploadForm } from "./bulk-upload-form";

export const maxDuration = 60;

export default function BulkUploadPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Reader Upload</CardTitle>
        <CardDescription>
          Upload an Excel (.xlsx) or CSV file with these columns:
        </CardDescription>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          <li><strong>Required:</strong> Reader Name, Mobile Number (10 digits), Complete Address, City, Center, Subscription Start Date (YYYY-MM-DD)</li>
          <li><strong>Optional:</strong> Email, Landmark, POC (must match a POC assigned to that Center), Remarks</li>
        </ul>
        <div className="mt-2">
          <Button variant="outline" size="sm" render={<Link href="/api/sample-bulk-csv" prefetch={false} />} nativeButton={false}>
            Download Sample CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <BulkUploadForm />
      </CardContent>
    </Card>
  );
}
