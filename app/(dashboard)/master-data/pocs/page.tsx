import { requireAdmin } from "@/lib/auth/session";
import { listPocs, listCenters, listAdmins } from "@/lib/data/master-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PocForm } from "./poc-form";
import { AddAdminForm } from "./add-admin-form";

export default async function PocsPage() {
  await requireAdmin();
  const [pocs, centers, admins] = await Promise.all([listPocs(), listCenters(), listAdmins()]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add POC</CardTitle>
        </CardHeader>
        <CardContent>
          {centers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a Center first.</p>
          ) : (
            <PocForm centers={centers} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POCs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Centers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pocs.map((poc) => (
                <TableRow key={poc.id}>
                  <TableCell>{poc.name}</TableCell>
                  <TableCell>{poc.email}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {poc.centers.map((c) => (
                      <Badge key={c.id} variant="secondary">
                        {c.name}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Administrator</CardTitle>
        </CardHeader>
        <CardContent>
          <AddAdminForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrators</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
