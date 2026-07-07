import { getPaymentIntentByTxnId } from "@/lib/data/payments";
import { generateInvoicePDF } from "@/lib/invoice/generate";

// Public — reached from an SMS link to an unauthenticated reader, same
// bearer-token trust model as app/pay/*. 404s unless the intent is a
// genuinely completed payment.
export async function GET(_request: Request, { params }: { params: Promise<{ txnId: string }> }) {
  const { txnId } = await params;
  const result = await getPaymentIntentByTxnId(txnId);
  if (!result || result.intent.status !== "success") {
    return new Response("Invoice not found.", { status: 404 });
  }

  const { intent, reader } = result;
  const pdfBuffer = await generateInvoicePDF({
    transactionId: intent.txnId,
    subscriberName: reader.name,
    amount: intent.amount,
    productInfo: "Subscription Payment",
    date: (intent.paidAt ?? intent.createdAt).toLocaleDateString("en-IN"),
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice_${txnId}.pdf"`,
    },
  });
}
