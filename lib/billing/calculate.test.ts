import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMonthCharge, priceOnDate, daysInMonth } from "./calculate";

const JULY_PRICE = [{ price: 310, effectiveFrom: "2026-01-01" }]; // 310/31 = 10/day exactly

test("full month, all delivered", () => {
  const attendance: Record<string, "delivered" | "not_delivered"> = {};
  for (let d = 1; d <= 31; d++) attendance[`2026-07-${String(d).padStart(2, "0")}`] = "delivered";
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance,
    pricingHistory: JULY_PRICE,
    today: "2026-08-01",
  });
  assert.equal(charge, 310);
});

test("full month, all absent", () => {
  const attendance: Record<string, "delivered" | "not_delivered"> = {};
  for (let d = 1; d <= 31; d++) attendance[`2026-07-${String(d).padStart(2, "0")}`] = "not_delivered";
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance,
    pricingHistory: JULY_PRICE,
    today: "2026-08-01",
  });
  assert.equal(charge, 0);
});

test("mixed delivered/absent", () => {
  const attendance: Record<string, "delivered" | "not_delivered"> = {};
  for (let d = 1; d <= 31; d++) {
    attendance[`2026-07-${String(d).padStart(2, "0")}`] = d <= 10 ? "not_delivered" : "delivered";
  }
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance,
    pricingHistory: JULY_PRICE,
    today: "2026-08-01",
  });
  assert.equal(charge, 210); // 21 delivered days * 10/day
});

test("unmarked days default to delivered", () => {
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance: {}, // nothing marked at all
    pricingHistory: JULY_PRICE,
    today: "2026-08-01",
  });
  assert.equal(charge, 310);
});

test("mid-month subscription start bills only from that date", () => {
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-07-22", // 10 days left in July (22-31)
    attendance: {},
    pricingHistory: JULY_PRICE,
    today: "2026-08-01",
  });
  assert.equal(charge, 100); // 10 days * 10/day
});

test("mid-month price change is billed per-day, not flat", () => {
  const pricingHistory = [
    { price: 300, effectiveFrom: "2026-01-01" },
    { price: 320, effectiveFrom: "2026-07-16" },
  ];
  // 15 days at 300/31 + 16 days at 320/31
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance: {},
    pricingHistory,
    today: "2026-08-01",
  });
  const expected = Math.round(((15 * 300 + 16 * 320) / 31) * 100) / 100;
  assert.equal(charge, expected);
});

test("in-progress month only bills up to today, not the full month", () => {
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance: {},
    pricingHistory: JULY_PRICE,
    today: "2026-07-10", // month still in progress
  });
  assert.equal(charge, 100); // days 1-10 = 10 days * 10/day
});

test("subscription starting after the queried month bills zero", () => {
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-08-01",
    attendance: {},
    pricingHistory: JULY_PRICE,
    today: "2026-08-15",
  });
  assert.equal(charge, 0);
});

test("priceOnDate picks the latest effective price on or before the date", () => {
  const history = [
    { price: 300, effectiveFrom: "2026-01-01" },
    { price: 320, effectiveFrom: "2026-06-01" },
  ];
  assert.equal(priceOnDate(history, "2026-05-31"), 300);
  assert.equal(priceOnDate(history, "2026-06-01"), 320);
  assert.equal(priceOnDate(history, "2026-12-31"), 320);
});

test("priceOnDate throws when no price is effective yet", () => {
  assert.throws(() => priceOnDate([{ price: 300, effectiveFrom: "2026-06-01" }], "2026-01-01"));
});

test("daysInMonth handles leap years", () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 7), 31);
});
