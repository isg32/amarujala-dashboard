"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generatePaymentLinkAction,
  sendGeneratedPaymentLinkSmsAction,
  previewPaymentLinkMessageAction,
  type GeneratedPaymentLink,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { QrCode } from "@/components/ui/qr-code";

type Coupon = { id: number; code: string; discountAmount: string };

function defaultMonthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function SendPaymentLinkButton({
  readerId,
  outstandingBalance,
  coupons,
}: {
  readerId: number;
  outstandingBalance: string;
  coupons: Coupon[];
}) {
  const router = useRouter();
  const [generatePending, startGenerateTransition] = useTransition();
  const [sendPending, startSendTransition] = useTransition();
  const [previewPending, startPreviewTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [voucherId, setVoucherId] = useState<string>("none");
  const [amount, setAmount] = useState<string>(outstandingBalance);
  const { start: defaultStart, end: defaultEnd } = defaultMonthBounds();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [testMode, setTestMode] = useState(false);
  const [testMobile, setTestMobile] = useState("");
  const [generatedLink, setGeneratedLink] = useState<GeneratedPaymentLink | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Any option change invalidates a previously generated link — never let
  // "Send" fire an SMS whose amount/dates no longer match what's on screen.
  function invalidateGeneratedLink() {
    setGeneratedLink(null);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            invalidateGeneratedLink();
          }}
          className="w-full sm:w-24"
          aria-label="Payment link amount"
        />
        {coupons.length > 0 && (
          <Select
            value={voucherId}
            onValueChange={(v) => {
              const id = v ?? "none";
              setVoucherId(id);
              // Suggest the discounted total; admin can still edit it further.
              const discount = id === "none" ? 0 : Number(coupons.find((c) => String(c.id) === id)?.discountAmount ?? 0);
              setAmount(Math.max(0, Number(outstandingBalance) - discount).toFixed(2));
              invalidateGeneratedLink();
            }}
            items={{
              none: "No voucher",
              ...Object.fromEntries(coupons.map((c) => [String(c.id), `${c.code} (-₹${c.discountAmount})`])),
            }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-36">
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
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="ghost" size="xs" />}>Customize</PopoverTrigger>
          <PopoverContent className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 text-xs" align="end">
      <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground" htmlFor={`startDate-${readerId}`}>
                  Bill period start
                </label>
                <Input
                  id={`startDate-${readerId}`}
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    invalidateGeneratedLink();
                  }}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground" htmlFor={`endDate-${readerId}`}>
                  Bill period end
                </label>
                <Input
                  id={`endDate-${readerId}`}
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    invalidateGeneratedLink();
                  }}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={testMode}
                onCheckedChange={(checked) => {
                  setTestMode(checked === true);
                  invalidateGeneratedLink();
                }}
              />
              Test mode — send to a different number instead of the reader&apos;s own
            </label>
            {testMode && (
              <Input
                type="tel"
                placeholder="Test mobile number"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
                className="h-7 text-xs"
              />
            )}

            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={previewPending}
              className="self-start"
              onClick={() => {
                startPreviewTransition(async () => {
                  const res = await previewPaymentLinkMessageAction(readerId, startDate, endDate);
                  setPreview("message" in res ? res.message : res.error);
                });
              }}
            >
              {previewPending ? "Loading..." : "Preview wording (fake link)"}
            </Button>
            {preview && <p className="rounded bg-muted p-2 text-muted-foreground">{preview}</p>}
            <p className="text-muted-foreground">
              The message wording itself is fixed (carrier-registered) — only the dates, amount, and link are
              adjustable. Use &quot;Generate Link&quot; below to see the real, working link before sending.
            </p>
          </PopoverContent>
        </Popover>

        {!generatedLink ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={generatePending}
            onClick={() => {
              setGenerateError(null);
              startGenerateTransition(async () => {
                const res = await generatePaymentLinkAction(readerId, {
                  voucherCouponId: voucherId === "none" ? undefined : Number(voucherId),
                  amountOverride: Number(amount),
                  startDate,
                  endDate,
                });
                if ("error" in res) setGenerateError(res.error);
                else setGeneratedLink(res);
              });
            }}
          >
            {generatePending ? "Generating..." : "Generate Link"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={sendPending || (testMode && !testMobile)}
            onClick={() => {
              setResult(null);
              startSendTransition(async () => {
                const res = await sendGeneratedPaymentLinkSmsAction(
                  readerId,
                  generatedLink,
                  startDate,
                  endDate,
                  testMode ? testMobile : undefined
                );
                setResult(res);
                if ("message" in res) {
                  setGeneratedLink(null);
                  setVoucherId("none");
                  router.refresh();
                }
              });
            }}
          >
            {sendPending ? "Sending..." : testMode ? "Send Test SMS" : "Send SMS"}
          </Button>
        )}
      </div>

      {generateError && <span className="max-w-56 text-right text-xs text-destructive max-sm:text-left">{generateError}</span>}

      {generatedLink && (
        <div className="flex max-w-80 flex-col gap-1 rounded-md border p-2 text-right text-xs max-sm:max-w-full">
          <span className="text-muted-foreground">Real link generated — review before sending:</span>
          <div className="flex items-center justify-end gap-2">
            <a href={generatedLink.payUrl} target="_blank" rel="noreferrer" className="break-all underline">
              {generatedLink.payUrl}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink.payUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="rounded bg-muted p-2 text-left text-muted-foreground">{generatedLink.message}</p>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="xs" onClick={() => setShowQr(!showQr)}>
              {showQr ? "Hide QR" : "Show QR"}
            </Button>
            {showQr && (
              <div className="flex justify-center">
                <QrCode url={generatedLink.payUrl} />
              </div>
            )}
          </div>
        </div>
      )}

      {result && "error" in result && <span className="max-w-56 text-right text-xs text-destructive max-sm:text-left">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
