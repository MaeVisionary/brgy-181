import type { CaseStage, KPCase } from '@/types/case'

/**
 * ONE set of rules for case lists and counts (Cases page and dashboards).
 * - active: every case not yet settled or closed.
 * - needs_update: cases whose record the Secretary still has to move forward
 *   (filed, under review, referred to the Lupon, mediation scheduled).
 */
export type CaseView = 'active' | 'needs_update'
export const CASE_VIEWS: readonly CaseView[] = ['active', 'needs_update']
export const CASE_VIEW_LABEL: Record<CaseView, string> = { active: 'Open cases (not settled or closed)', needs_update: 'Case records to update' }
const NEEDS_UPDATE: CaseStage[] = ['filed', 'under_review', 'referred_to_lupon', 'mediation_scheduled']

export function inCaseView(c: KPCase, v: CaseView | ''): boolean {
  if (v === 'active') return !['closed', 'settled'].includes(c.stage)
  if (v === 'needs_update') return NEEDS_UPDATE.includes(c.stage)
  return true
}
export const filterCases = (list: KPCase[], f: { stage?: CaseStage | ''; view?: CaseView | '' }) =>
  list.filter((c) => (!f.stage || c.stage === f.stage) && inCaseView(c, f.view ?? ''))
