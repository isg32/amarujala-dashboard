// Pure, DB-free billing math — the highest-risk correctness surface in this
// app. Formula (confirmed): daily_rate = price_effective_that_day /
// days_in_that_calendar_month; monthly charge = sum of daily_rate over days
// marked 'delivered'. Unmarked days default to delivered. Mid-month price
// changes and mid-month subscription starts are handled naturally by summing
// per-day rather than multiplying a flat monthly price.
//
// Most readers bill on the calendar month (calculateMonthCharge). A reader
// can instead have a custom billing-cycle anchor day (1-28) so their cycle
// runs [anchorDay .. anchorDay-1 of next month] — see getBillingCycle() and
// calculateCycleCharge(), which calculateMonthCharge is itself built on.

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

// A Center or Unit override, when active, pins the DAILY rate outright
// (unlike city_pricing, which is a monthly price divided by days in that
// date's own calendar month — overrides are already per-day, matching how
// they're entered in the UI). This is the "Day Rates" mechanism. Falls back
// to the normal city_pricing history lookup when no override applies, and
// only reaches for the org-wide global default if that city has no price
// configured at all (so global never silently overrides a real, configured
// city price). Days-in-month is derived from `date` itself (not passed in)
// so a charge period spanning two calendar months — as a custom billing
// cycle can — prorates each day against its own month correctly.
export function resolveDailyRate(params: {
  date: string;
  pricingHistory: PricePeriod[];
  centerOverride?: number | null;
  unitOverride?: number | null;
  globalDefault?: number | null;
  /** A one-day-only price (e.g. a festival hike) for this exact `date`.
   * Outranks even centerOverride/unitOverride — see the pricing_overrides
   * table's `forDate` column. */
  specialDayPrice?: number | null;
}): number {
  if (params.specialDayPrice != null) return params.specialDayPrice;
  if (params.centerOverride != null) return params.centerOverride;
  if (params.unitOverride != null) return params.unitOverride;
  try {
    const [year, month] = params.date.split("-").map(Number);
    return priceOnDate(params.pricingHistory, params.date) / daysInMonth(year, month);
  } catch (err) {
    if (params.globalDefault != null) return params.globalDefault;
    throw err;
  }
}

export interface CalculateCycleChargeParams {
  /** 'YYYY-MM-DD', inclusive */
  cycleStart: string;
  /** 'YYYY-MM-DD', inclusive */
  cycleEnd: string;
  /** 'YYYY-MM-DD' */
  subscriptionStartDate: string;
  /** date -> status; a date absent from this map is "unmarked" and counts as delivered */
  attendance: Record<string, AttendanceStatus>;
  pricingHistory: PricePeriod[];
  /**
   * 'YYYY-MM-DD', defaults to the real current date. Caps the billed range
   * so an in-progress cycle's live total only covers days that have
   * actually happened yet. For a past/completed cycle this has no effect.
   */
  today?: string;
  /** Optional Day Rates overrides — see resolveDailyRate(). */
  centerOverride?: number | null;
  unitOverride?: number | null;
  globalDefault?: number | null;
  /** date ('YYYY-MM-DD') -> one-day-only price, e.g. festival hikes. */
  specialDayPrices?: Record<string, number>;
}

export function calculateCycleCharge(params: CalculateCycleChargeParams): number {
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  const periodStart = params.subscriptionStartDate > params.cycleStart ? params.subscriptionStartDate : params.cycleStart;
  const periodEnd = today < params.cycleEnd ? today : params.cycleEnd;

  if (periodStart > periodEnd) return 0;

  let total = 0;
  const cursor = new Date(periodStart + "T00:00:00Z");
  const end = new Date(periodEnd + "T00:00:00Z");
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const status = params.attendance[dateStr];
    if (status !== "not_delivered") {
      total += resolveDailyRate({
        date: dateStr,
        pricingHistory: params.pricingHistory,
        centerOverride: params.centerOverride,
        unitOverride: params.unitOverride,
        globalDefault: params.globalDefault,
        specialDayPrice: params.specialDayPrices?.[dateStr],
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.round(total * 100) / 100;
}

export interface CalculateMonthChargeParams {
  /** 'YYYY-MM' */
  billingPeriod: string;
  subscriptionStartDate: string;
  attendance: Record<string, AttendanceStatus>;
  pricingHistory: PricePeriod[];
  today?: string;
  centerOverride?: number | null;
  unitOverride?: number | null;
  globalDefault?: number | null;
  specialDayPrices?: Record<string, number>;
}

// Thin wrapper over calculateCycleCharge for the calendar-month case (the
// default for readers with no custom billing anchor).
export function calculateMonthCharge(params: CalculateMonthChargeParams): number {
  const [yearStr, monthStr] = params.billingPeriod.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const totalDaysInMonth = daysInMonth(year, month);
  const cycleStart = `${params.billingPeriod}-01`;
  const cycleEnd = `${params.billingPeriod}-${String(totalDaysInMonth).padStart(2, "0")}`;
  return calculateCycleCharge({ ...params, cycleStart, cycleEnd });
}

// For a reader on a custom billing-cycle anchor day (1-28, enforced at the
// UI layer to dodge month-length edge cases), returns the [cycleStart,
// cycleEnd] window (inclusive) that contains referenceDate. E.g. anchorDay
// 15 with referenceDate 2026-07-20 -> { 2026-07-15, 2026-08-14 }; with
// referenceDate 2026-07-10 -> { 2026-06-15, 2026-07-14 }.
export function getBillingCycle(anchorDay: number, referenceDate: string): { cycleStart: string; cycleEnd: string } {
  const [y, m, d] = referenceDate.split("-").map(Number);

  let startYear = y;
  let startMonth = m;
  if (d < anchorDay) {
    startMonth -= 1;
    if (startMonth === 0) {
      startMonth = 12;
      startYear -= 1;
    }
  }

  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth === 13) {
    endMonth = 1;
    endYear += 1;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const cycleStart = `${startYear}-${pad(startMonth)}-${pad(anchorDay)}`;
  const cycleEnd = `${endYear}-${pad(endMonth)}-${pad(anchorDay - 1)}`;
  return { cycleStart, cycleEnd };
}
