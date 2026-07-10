import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BulkUploadForm } from "./bulk-upload-form";

// Large spreadsheets can take a while to validate + insert; raise the
// Server Action timeout above the platform default (60s is the max on
// Vercel's Hobby plan, raise further on Pro).
export const maxDuration = 60;

export default function BulkUploadPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Reader Upload</CardTitle>
        <CardDescription>
          Columns: Reader Name, Mobile Number, Complete Address, City, Center, Subscription Start
          Date (required); Email, Landmark, Remarks (optional).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BulkUploadForm />
      </CardContent>
    </Card>
  );
}
