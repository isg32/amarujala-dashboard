import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMonthCharge,
  calculateCycleCharge,
  getBillingCycle,
  priceOnDate,
  resolveDailyRate,
  daysInMonth,
} from "./calculate";

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

test("resolveDailyRate: center override wins over everything", () => {
  const rate = resolveDailyRate({
    date: "2026-07-01",
    pricingHistory: [{ price: 310, effectiveFrom: "2026-01-01" }],
    centerOverride: 7,
    unitOverride: 5,
    globalDefault: 8,
  });
  assert.equal(rate, 7);
});

test("resolveDailyRate: unit override wins over city pricing history", () => {
  const rate = resolveDailyRate({
    date: "2026-07-01",
    pricingHistory: [{ price: 310, effectiveFrom: "2026-01-01" }],
    unitOverride: 5,
  });
  assert.equal(rate, 5);
});

test("resolveDailyRate: falls back to city pricing history (divided by days in month)", () => {
  const rate = resolveDailyRate({
    date: "2026-07-01",
    pricingHistory: [{ price: 310, effectiveFrom: "2026-01-01" }],
  });
  assert.equal(rate, 10);
});

test("resolveDailyRate: global default only applies when city has no price at all", () => {
  const rate = resolveDailyRate({
    date: "2026-07-01",
    pricingHistory: [],
    globalDefault: 8,
  });
  assert.equal(rate, 8);
});

test("resolveDailyRate: throws when nothing resolves", () => {
  assert.throws(() => resolveDailyRate({ date: "2026-07-01", pricingHistory: [] }));
});

test("calculateMonthCharge honors a unit override as a flat per-day rate", () => {
  const charge = calculateMonthCharge({
    billingPeriod: "2026-07",
    subscriptionStartDate: "2026-01-01",
    attendance: {},
    pricingHistory: JULY_PRICE, // would otherwise bill 310 for the month
    today: "2026-08-01",
    unitOverride: 7,
  });
  assert.equal(charge, 7 * 31);
});

test("resolveDailyRate: a special-day price outranks center/unit overrides", () => {
  const rate = resolveDailyRate({
    date: "2026-10-20",
    pricingHistory: [{ price: 310, effectiveFrom: "2026-01-01" }],
    centerOverride: 7,
    unitOverride: 5,
    specialDayPrice: 50,
  });
  assert.equal(rate, 50);
});

test("calculateMonthCharge applies a festival one-day hike only on that date", () => {
  const attendance: Record<string, "delivered" | "not_delivered"> = {};
  for (let d = 1; d <= 31; d++) attendance[`2026-10-${String(d).padStart(2, "0")}`] = "delivered";
  const charge = calculateMonthCharge({
    billingPeriod: "2026-10",
    subscriptionStartDate: "2026-01-01",
    attendance,
    pricingHistory: JULY_PRICE, // 310/31 = 10/day
    today: "2026-11-01",
    specialDayPrices: { "2026-10-20": 100 },
  });
  // 30 normal days at 10/day + 1 festival day at 100
  assert.equal(charge, 30 * 10 + 100);
});

test("getBillingCycle: reference date past the anchor falls in this month's cycle", () => {
  const { cycleStart, cycleEnd } = getBillingCycle(15, "2026-07-20");
  assert.equal(cycleStart, "2026-07-15");
  assert.equal(cycleEnd, "2026-08-14");
});

test("getBillingCycle: reference date before the anchor falls in last month's cycle", () => {
  const { cycleStart, cycleEnd } = getBillingCycle(15, "2026-07-10");
  assert.equal(cycleStart, "2026-06-15");
  assert.equal(cycleEnd, "2026-07-14");
});

test("getBillingCycle: rolls over the year boundary", () => {
  const { cycleStart, cycleEnd } = getBillingCycle(15, "2026-01-05");
  assert.equal(cycleStart, "2025-12-15");
  assert.equal(cycleEnd, "2026-01-14");
});

test("calculateCycleCharge prorates a cross-month cycle against each day's own month", () => {
  // Cycle 2026-07-15..2026-08-14: 17 days of July (31-day month) + 14 days
  // of August (31-day month too, so same day-count coincidence avoided by
  // picking a price that only matters if per-day division is wrong).
  const pricingHistory = [{ price: 620, effectiveFrom: "2026-01-01" }]; // 620/31 = 20/day in both months
  const charge = calculateCycleCharge({
    cycleStart: "2026-07-15",
    cycleEnd: "2026-08-14",
    subscriptionStartDate: "2026-01-01",
    attendance: {},
    pricingHistory,
    today: "2026-09-01",
  });
  assert.equal(charge, 31 * 20); // 17 July days + 14 Aug days = 31 days * 20/day
});
