import "server-only";

// This is PayU's PRODUCTION endpoint — the key/salt provided for this app
// are production credentials (confirmed in the old app's own source
// comment: "Changed to Production URL since the provided key is a
// Production Key"). There is no sandbox mode available without separately
// requesting PayU test credentials, so PAYU_GATEWAY_ENABLED gates every
// entry point that could create a real, chargeable payment link — it must
// be deliberately set to "true" in the environment (never via the UI)
// before any real transaction can happen.
export const PAYU_ENDPOINT = "https://secure.payu.in/_payment";
export const PAYU_GATEWAY_ENABLED = process.env.PAYU_GATEWAY_ENABLED === "true";

export function getPayuCredentials() {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  if (!key || !salt) {
    throw new Error("PayU is not configured: PAYU_KEY/PAYU_SALT missing from the environment.");
  }
  return { key, salt };
}
