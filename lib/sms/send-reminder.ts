import "server-only";

// ponytail: no live SMS vendor wired up — logs instead. Swap the body of
// this function for a real provider (Twilio, MSG91, etc.) when one is
// chosen; callers don't need to change.
export async function sendPaymentReminder(reader: { name: string; mobile: string; outstandingBalance: string }) {
  console.log(
    `[SMS STUB] To ${reader.mobile}: Hi ${reader.name}, your outstanding balance is ₹${reader.outstandingBalance}. Please pay at your earliest convenience.`
  );
}
