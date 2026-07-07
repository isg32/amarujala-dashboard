// Pure, DB-free billing math — the highest-risk correctness surface in this
// app. Formula (confirmed): daily_rate = price_effective_that_day /
// days_in_month; monthly charge = sum of daily_rate over days marked
// 'delivered'. Unmarked days default to delivered. Mid-month price changes
// and mid-month subscription starts are handled naturally by summing
// per-day rather than multiplying a flat monthly price.

export type AttendanceStatus = "delivered" | "not_delivered";

export interface PricePeriod {
  price: number;
  effectiveFrom: string; // YYYY-MM-DD
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function priceOnDate(pricingHistory: PricePeriod[], date: string): number {
  const applicable = pricingHistory
    .filter((p) => p.effectiveFrom <= date)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  if (applicable.length === 0) {
    throw new Error(`No city price found effective on or before ${date}`);
  }
  return applicable[0].price;
}

export interface CalculateMonthChargeParams {
  /** 'YYYY-MM' */
  billingPeriod: string;
  /** 'YYYY-MM-DD' */
  subscriptionStartDate: string;
  /** date -> status; a date absent from this map is "unmarked" and counts as delivered */
  attendance: Record<string, AttendanceStatus>;
  pricingHistory: PricePeriod[];
  /**
   * 'YYYY-MM-DD', defaults to the real current date. Caps the billed range
   * so an in-progress month's live total only covers days that have
   * actually happened yet. For a past month this has no effect (today is
   * already past month-end, so the full month is billed).
   */
  today?: string;
}

export function calculateMonthCharge(params: CalculateMonthChargeParams): number {
  const [yearStr, monthStr] = params.billingPeriod.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const totalDaysInMonth = daysInMonth(year, month);
  const monthStart = `${params.billingPeriod}-01`;
  const monthEnd = `${params.billingPeriod}-${String(totalDaysInMonth).padStart(2, "0")}`;
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  const periodStart = params.subscriptionStartDate > monthStart ? params.subscriptionStartDate : monthStart;
  const periodEnd = today < monthEnd ? today : monthEnd;

  if (periodStart > periodEnd) return 0;

  let total = 0;
  const cursor = new Date(periodStart + "T00:00:00Z");
  const end = new Date(periodEnd + "T00:00:00Z");
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const status = params.attendance[dateStr];
    if (status !== "not_delivered") {
      total += priceOnDate(params.pricingHistory, dateStr) / totalDaysInMonth;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.round(total * 100) / 100;
}
