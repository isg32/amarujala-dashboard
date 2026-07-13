import { NextResponse } from "next/server";
import { getPaymentIntentByTxnId, markPaymentIntentResult } from "@/lib/data/payments";
import { getPayuCredentials } from "@/lib/payu/config";
import { computeReverseHash } from "@/lib/payu/hash";

// PayU POSTs the transaction result here (both surl/furl point at this same
// route, ported from the old app-api/payu/response/+server.ts). No session
// exists — the reverse hash is the only authentication, so it MUST be
// verified before trusting anything else in the form body.
export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  // Next's basePath auto-prefixing (see next.config.ts) only covers next/link
  // and redirect() — a raw NextResponse.redirect() to an already-absolute
  // URL needs the prefix added by hand or it 404s on the self-hosted
  // /dashboard deployment.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const redirect = (path: string) => NextResponse.redirect(new URL(basePath + path, origin), { status: 302 });

  try {
    const formData = await request.formData();
    const txnid = String(formData.get("txnid") ?? "");
    const amount = String(formData.get("amount") ?? "");
    const productinfo = String(formData.get("productinfo") ?? "");
    const firstname = String(formData.get("firstname") ?? "");
    const email = String(formData.get("email") ?? "");
    const status = String(formData.get("status") ?? "");
    const payuHash = String(formData.get("hash") ?? "");

    const { key, salt } = getPayuCredentials();
    const generatedHash = computeReverseHash({ key, salt, status, txnId: txnid, amount, productInfo: productinfo, firstName: firstname, email });
    if (generatedHash !== payuHash) {
      console.error("[PayU webhook] Reverse hash mismatch — possible tampering.", { txnid, status });
      return redirect("/pay/failure?reason=hash_mismatch");
    }

    const result = await getPaymentIntentByTxnId(txnid);
    if (!result) return redirect("/pay/failure?reason=not_found");
    const { intent, reader } = result;

    if (status !== "success") {
      await markPaymentIntentResult(txnid, "failed");
      return redirect("/pay/failure");
    }

    if (Number(amount) !== Number(intent.amount)) {
      console.error("[PayU webhook] Amount mismatch — possible tampering.", { txnid, expected: intent.amount, got: amount });
      return redirect("/pay/failure?reason=amount_mismatch");
    }

    const { alreadyProcessed } = await markPaymentIntentResult(txnid, "success");
    if (!alreadyProcessed) {
      // No DLT-registered SMS template exists for "payment received, here's
      // your invoice" (the old app never actually wired this — its
      // sendInvoiceSMS was a permanent stub, unlike the two real VISPL
      // templates used elsewhere). Sending arbitrary text through a live
      // DLT-gated SMS account risks the message being dropped or the
      // account being flagged, so this logs instead until a template is
      // registered for it — same posture the old app shipped with.
      console.log(`[PayU webhook] Payment succeeded for ${reader.name} (${reader.mobile}). Invoice: ${origin}${basePath}/api/invoice/${txnid}`);
    }

    return redirect("/pay/success");
  } catch (err) {
    console.error("[PayU webhook] Unhandled error:", err);
    return redirect("/pay/failure?reason=server_error");
  }
}
