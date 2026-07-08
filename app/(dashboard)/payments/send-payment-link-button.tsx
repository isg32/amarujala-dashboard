"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendPaymentLinkAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Coupon = { id: number; code: string; discountAmount: string };

export function SendPaymentLinkButton({ readerId, coupons }: { readerId: number; coupons: Coupon[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);
  const [voucherId, setVoucherId] = useState<string>("none");

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {coupons.length > 0 && (
          <Select value={voucherId} onValueChange={(v) => setVoucherId(v ?? "none")}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="No voucher" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No voucher</SelectItem>
                {coupons.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} (-₹{c.discountAmount})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            setResult(null);
            const couponId = voucherId === "none" ? undefined : Number(voucherId);
            startTransition(async () => {
              const res = await sendPaymentLinkAction(readerId, couponId);
              setResult(res);
              if ("message" in res) {
                setVoucherId("none");
                router.refresh();
              }
            });
          }}
        >
          {pending ? "Sending..." : "Send Payment Link"}
        </Button>
      </div>
      {result && "error" in result && <span className="max-w-56 text-right text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
