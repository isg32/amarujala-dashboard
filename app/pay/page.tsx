import { headers } from "next/headers";
import { getPaymentIntentByTxnId } from "@/lib/data/payments";
import { getPayuCredentials, PAYU_ENDPOINT } from "@/lib/payu/config";
import { computeForwardHash } from "@/lib/payu/hash";
import { PayuAutoSubmitForm } from "./payu-auto-submit-form";

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: txnId } = await searchParams;
  if (!txnId) {
    return <PayMessage title="Invalid payment link" body="No transaction was specified." />;
  }

  const result = await getPaymentIntentByTxnId(txnId);
  if (!result) {
    return <PayMessage title="Payment link not found" body="This payment link is invalid or has expired." />;
  }

  const { intent, reader } = result;
  if (intent.status === "success") {
    return <PayMessage title="Already paid" body="This payment has already been completed." />;
  }
  if (intent.status === "failed") {
    return <PayMessage title="Payment link no longer valid" body="This payment attempt was not completed. Ask for a new link." />;
  }

  const { key, salt } = getPayuCredentials();
  const email = reader.email || "noemail@example.com";
  const productInfo = "Subscription Payment";
  const hash = computeForwardHash({
    key,
    salt,
    txnId: intent.txnId,
    amount: intent.amount,
    productInfo,
    firstName: reader.name,
    email,
  });

  const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
  const webhookUrl = `${origin}/api/payu/webhook`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Redirecting to payment...</p>
      <PayuAutoSubmitForm
        action={PAYU_ENDPOINT}
        fields={{
          key,
          txnid: intent.txnId,
          amount: intent.amount,
          productinfo: productInfo,
          firstname: reader.name,
          email,
          phone: reader.mobile,
          surl: webhookUrl,
          furl: webhookUrl,
          hash,
        }}
      />
    </div>
  );
}

function PayMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center text-foreground">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
