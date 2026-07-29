/** Legacy `page-planner` progress-bar color thresholds, preserved exactly — extracted to named constants (the legacy code inlined them). */
export const WARNING_THRESHOLD_PERCENT = 60;
export const DANGER_THRESHOLD_PERCENT = 90;

const PERCENT_SCALE = 100n;

export type PlannerProgressStatus = 'success' | 'warning' | 'danger';

/**
 * `round(spent / budgeted * 100)`, entirely in `bigint` minor units — see
 * `GetPlannerSummaryService.computePercent` (budget-application) for the
 * backend-side mirror of this exact formula. Returns `0` when `budgeted` is
 * zero or negative rather than dividing by zero.
 */
export function computeBudgetPercent(
  spentMinorUnits: bigint,
  budgetedMinorUnits: bigint,
): number {
  if (budgetedMinorUnits <= 0n) {
    return 0;
  }

  const halfForRounding = budgetedMinorUnits / 2n;
  const roundedPercent =
    (spentMinorUnits * PERCENT_SCALE + halfForRounding) / budgetedMinorUnits;

  return Number(roundedPercent);
}

/** Maps a spend percentage to its progress-bar status, per the legacy 60/90% thresholds (strictly greater-than, so the boundary values themselves stay in the lower tier). */
export function resolveProgressStatus(percent: number): PlannerProgressStatus {
  if (percent > DANGER_THRESHOLD_PERCENT) {
    return 'danger';
  }
  if (percent > WARNING_THRESHOLD_PERCENT) {
    return 'warning';
  }
  return 'success';
}

/** Bar-fill percent used for a spend-but-no-budget category — rendered as a fully filled danger bar, never a 0% "on track" bar. */
export const UNBUDGETED_OVERSPEND_PERCENT = 100;

/** One row's resolved progress-bar percent + status. */
export interface PlannerProgressDisplay {
  readonly percent: number;
  readonly status: PlannerProgressStatus;
}

/**
 * Combines `computeBudgetPercent`/`resolveProgressStatus` with the one case
 * they can't express on their own: `budgeted === 0` short-circuits the
 * percent formula to `0` (to avoid a divide-by-zero), which is correct
 * numerically but reads on-screen as "on track" — indistinguishable from a
 * genuinely untouched 0/0 category — even when `spent > 0` (a category
 * overspent with no budget set at all). That case is forced to a fully
 * filled danger bar instead.
 */
export function resolveProgressDisplay(
  spentMinorUnits: bigint,
  budgetedMinorUnits: bigint,
): PlannerProgressDisplay {
  if (budgetedMinorUnits <= 0n && spentMinorUnits > 0n) {
    return { percent: UNBUDGETED_OVERSPEND_PERCENT, status: 'danger' };
  }

  const percent = computeBudgetPercent(spentMinorUnits, budgetedMinorUnits);
  return { percent, status: resolveProgressStatus(percent) };
}

/** A progress bar split into a "within budget" (green) segment and an "over budget" (red) segment, each a fraction of the bar's total width. */
export interface PlannerProgressSegments {
  readonly withinBudgetPercent: number;
  readonly overBudgetPercent: number;
}

const FULL_BAR_PERCENT = 100;

/**
 * Below/at 100% spend, the bar is a single partially-filled segment — no
 * overspend to show, so `overBudgetPercent` is `0`. Above 100%, the bar is
 * fully covered and split proportionally: `withinBudgetPercent` shrinks to
 * `budgeted / spent * 100` (the share of total spend that stayed in
 * budget) and `overBudgetPercent` takes the rest, so the two always sum to
 * 100 in the overspend case.
 */
export function resolveProgressSegments(
  percent: number,
): PlannerProgressSegments {
  if (percent <= FULL_BAR_PERCENT) {
    return { withinBudgetPercent: Math.max(0, percent), overBudgetPercent: 0 };
  }

  const withinBudgetPercent = (FULL_BAR_PERCENT * FULL_BAR_PERCENT) / percent;
  return {
    withinBudgetPercent,
    overBudgetPercent: FULL_BAR_PERCENT - withinBudgetPercent,
  };
}
