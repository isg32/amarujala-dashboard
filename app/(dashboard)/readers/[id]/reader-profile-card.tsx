"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditReaderForm } from "./edit-reader-form";

type Reader = {
  id: number;
  name: string;
  readerCode: string;
  mobile: string;
  email: string | null;
  address: string;
  landmark: string | null;
  cityName: string;
  centerName: string;
  pocName: string | null;
  subscriptionStartDate: string;
  status: "active" | "inactive";
};

type Transfer = {
  id: number;
  fromCenterName: string;
  toCenterName: string;
  transferredAt: Date;
  remarks: string | null;
};

export function ReaderProfileCard({
  reader,
  transfers,
  isAdmin,
  actions,
}: {
  reader: Reader;
  transfers: Transfer[];
  isAdmin: boolean;
  actions: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {reader.name}
            <Badge variant={reader.status === "active" ? "secondary" : "outline"}>{reader.status}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{reader.readerCode}</p>
        </div>
        <div className="flex gap-2">
          {actions}
          {isAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      {editing ? (
        <CardContent>
          <EditReaderForm reader={reader} onDone={() => setEditing(false)} />
        </CardContent>
      ) : (
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
            <div className="text-muted-foreground">Address</div>
            <div>{reader.address}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Landmark</div>
            <div>{reader.landmark ?? "—"}</div>
          </div>
        </CardContent>
      )}

      {transfers.length > 0 && (
        <CardContent className="border-t pt-4 text-sm">
          <div className="mb-2 text-muted-foreground">Transfer History</div>
          <div className="flex flex-col gap-1.5">
            {transfers.map((t) => (
              <div key={t.id} className="text-xs text-muted-foreground">
                {t.transferredAt.toISOString().slice(0, 10)}: {t.fromCenterName} → {t.toCenterName}
                {t.remarks ? ` — ${t.remarks}` : ""}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
