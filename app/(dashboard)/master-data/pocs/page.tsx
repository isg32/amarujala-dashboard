import { requireAdmin } from "@/lib/auth/session";
import { listPocs, listCenters, listCities, listAdmins } from "@/lib/data/master-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { PocForm } from "./poc-form";
import { PocRow } from "./poc-row";
import { AddAdminForm } from "./add-admin-form";
import { AdminRow } from "./admin-row";

export default async function PocsPage() {
  const currentUser = await requireAdmin();
  const [pocs, centers, cities, admins] = await Promise.all([listPocs(), listCenters(), listCities(), listAdmins()]);

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add POC</CardTitle>
        </CardHeader>
        <CardContent>
          {centers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a Center first.</p>
          ) : (
            <PocForm centers={centers} cities={cities} />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pocs.map((poc) => (
                <PocRow key={poc.id} poc={poc} allCenters={centers} cities={cities} />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <AdminRow
                  key={admin.id}
                  admin={admin}
                  isSelf={admin.id === currentUser.id}
                  canManageAdminPasswords={currentUser.canManageAdminPasswords}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
