import "server-only";
import crypto from "crypto";

// PayU's fixed hash spec (not creative content — this is their published
// protocol), ported verbatim from the old app's pay/+page.server.ts and
// app-api/payu/response/+server.ts, udf1-5 slots kept explicit (always
// empty here) rather than hand-collapsed, since the exact pipe count in
// this string is part of PayU's spec and easy to get wrong by hand.
const UDF = "";

export function computeForwardHash(params: {
  key: string;
  salt: string;
  txnId: string;
  amount: string;
  productInfo: string;
  firstName: string;
  email: string;
}) {
  const hashString = `${params.key}|${params.txnId}|${params.amount}|${params.productInfo}|${params.firstName}|${params.email}|${UDF}|${UDF}|${UDF}|${UDF}|${UDF}||||||${params.salt}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}

export function computeReverseHash(params: {
  key: string;
  salt: string;
  status: string;
  txnId: string;
  amount: string;
  productInfo: string;
  firstName: string;
  email: string;
}) {
  const hashString = `${params.salt}|${params.status}||||||${UDF}|${UDF}|${UDF}|${UDF}|${UDF}|${params.email}|${params.firstName}|${params.productInfo}|${params.amount}|${params.txnId}|${params.key}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}
