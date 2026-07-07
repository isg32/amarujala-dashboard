export default async function PayFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center text-foreground">
      <h1 className="text-xl font-semibold">Payment not completed</h1>
      <p className="text-sm text-muted-foreground">
        {reason ? `The payment could not be processed (${reason}).` : "The payment could not be processed."} Please ask for a new payment link.
      </p>
    </div>
  );
}
