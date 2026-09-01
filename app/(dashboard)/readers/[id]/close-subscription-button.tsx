"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeSubscriptionAction } from "../../billing/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { formatAmountDue } from "@/lib/billing/format";
import {
  ADJUSTMENT_REASON_PRESETS,
  ADJUSTMENT_REASON_OTHER,
  resolveAdjustmentReason,
  signedAdjustmentAmount,
  type AdjustmentDirection,
} from "@/lib/billing/adjustment";

interface CloseSubscriptionButtonProps {
  readerId: number;
  readerName: string;
  amountDue: number;
  isAdmin?: boolean;
}

export function CloseSubscriptionButton({ readerId, readerName, amountDue, isAdmin = false }: CloseSubscriptionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);

  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDirection, setAdjDirection] = useState<AdjustmentDirection>("reduce");
  const [adjReasonPreset, setAdjReasonPreset] = useState<string>(ADJUSTMENT_REASON_PRESETS[0]);
  const [adjReasonOther, setAdjReasonOther] = useState("");

  const pendingAmount = amountDue > 0 ? amountDue : 0;

  const buildAdjustment = (): { amount: number; reason: string } | undefined => {
    if (!isAdmin || !showAdjustment) return undefined;
    const abs = Number(adjAmount);
    if (!Number.isFinite(abs) || abs <= 0) return undefined;
    const reason = resolveAdjustmentReason(adjReasonPreset, adjReasonOther);
    if (!reason) return undefined;
    return { amount: signedAdjustmentAmount(abs, adjDirection), reason };
  };

  const handleClose = () => {
    const adjustment = buildAdjustment();

    if (showAdjustment && isAdmin && !adjustment && Number(adjAmount) > 0) {
      setResult({ error: "Enter what the adjustment is for." });
      return;
    }

    let message = `Close ${readerName}'s subscription? `;
    if (pendingAmount > 0) {
      message += `This will post a final charge of ₹${pendingAmount.toFixed(2)} for delivered papers. `;
    } else {
      message += `No outstanding balance. `;
    }
    if (adjustment) {
      const verb = adjustment.amount < 0 ? "credit" : "charge";
      message += `A "${adjustment.reason}" ${verb} of ₹${Math.abs(adjustment.amount).toFixed(2)} will also be posted. `;
    }
    message += `The reader will be marked inactive. This cannot be undone from here.`;

    if (!confirm(message)) return;

    setResult(null);
    startTransition(async () => {
      const res = await closeSubscriptionAction(readerId, adjustment);
      setResult(res);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {pendingAmount > 0 && (
        <div className="text-xs text-muted-foreground">
          Pending: <span className="font-medium">{formatAmountDue(pendingAmount)}</span>
        </div>
      )}

      {isAdmin && (
        <div className="w-full max-w-xs rounded-md border p-2 text-xs">
          <label className="flex items-center gap-2 font-medium">
            <Checkbox
              checked={showAdjustment}
              onCheckedChange={(v) => setShowAdjustment(v === true)}
              disabled={pending}
            />
            Add a closing adjustment
          </label>
          {showAdjustment && (
            <div className="mt-2 flex flex-col gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount (₹)"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                disabled={pending}
              />
              <Select
                value={adjDirection}
                onValueChange={(v) => setAdjDirection(v === "increase" ? "increase" : "reduce")}
                items={{ reduce: "Reduce balance (credit)", increase: "Increase balance (charge)" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="reduce">Reduce balance (credit)</SelectItem>
                    <SelectItem value="increase">Increase balance (charge)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={adjReasonPreset}
                onValueChange={(v) => setAdjReasonPreset(typeof v === "string" ? v : ADJUSTMENT_REASON_PRESETS[0])}
                items={{
                  ...Object.fromEntries(ADJUSTMENT_REASON_PRESETS.map((r) => [r, r])),
                  [ADJUSTMENT_REASON_OTHER]: ADJUSTMENT_REASON_OTHER,
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ADJUSTMENT_REASON_PRESETS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                    <SelectItem value={ADJUSTMENT_REASON_OTHER}>{ADJUSTMENT_REASON_OTHER}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {adjReasonPreset === ADJUSTMENT_REASON_OTHER && (
                <Input
                  placeholder="Describe the adjustment"
                  value={adjReasonOther}
                  onChange={(e) => setAdjReasonOther(e.target.value)}
                  disabled={pending}
                />
              )}
            </div>
          )}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleClose}>
        {pending ? "Closing..." : "Close Subscription"}
      </Button>
      {result && "error" in result && <span className="text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
