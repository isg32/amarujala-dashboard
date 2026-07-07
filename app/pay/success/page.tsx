export default function PaySuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center text-foreground">
      <h1 className="text-xl font-semibold">Payment successful</h1>
      <p className="text-sm text-muted-foreground">Thank you — your payment has been received. You&apos;ll get an SMS with your receipt shortly.</p>
    </div>
  );
}
