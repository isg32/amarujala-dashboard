import { requireAdmin } from "@/lib/auth/session";
import { listPocs, listCenters, listAdmins } from "@/lib/data/master-data";
import { deleteAdminAction } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PocForm } from "./poc-form";
import { PocRow } from "./poc-row";
import { AddAdminForm } from "./add-admin-form";
import { DeleteButton } from "../delete-button";

export default async function PocsPage() {
  const currentUser = await requireAdmin();
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pocs.map((poc) => (
                <PocRow key={poc.id} poc={poc} allCenters={centers} />
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
                <TableRow key={admin.id}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell className="text-right">
                    {admin.id === currentUser.id ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : (
                      <DeleteButton
                        action={deleteAdminAction.bind(null, admin.id)}
                        confirmMessage={`Delete administrator "${admin.name}"? This also removes their login.`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
