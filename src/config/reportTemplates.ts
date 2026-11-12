/**
 * Report formats bundled with the system (public/report-templates).
 * "official": the barangay's own file from its shared drive (blank form).
 * "prepared": a format made for BMIS from the barangay's records; replace it
 * by uploading the office's official file in Reports.
 */
export interface BuiltInReportTemplate {
  file: string
  fileName: string
  kind: 'official' | 'prepared'
}

export const BUILTIN_REPORT_TEMPLATES: Record<string, BuiltInReportTemplate> = {
  dilg: { file: 'dilg.docx', fileName: 'BOIS Form (Annex A, Revised 2023).docx', kind: 'official' },
  osca: { file: 'osca.docx', fileName: 'Senior Citizen Social Pension Transmittal.docx', kind: 'official' },
  madao: { file: 'madao.docx', fileName: 'BADAC Monthly Report Transmittal.docx', kind: 'official' },
  bureau: { file: 'bureau.docx', fileName: 'Monthly Accomplishment Report.docx', kind: 'prepared' },
  'recurring-cleanup': { file: 'recurring-cleanup.docx', fileName: 'Weekly Clean-up Report (Annex A).docx', kind: 'official' },
  'recurring-senior-masterlist': { file: 'recurring-senior-masterlist.xlsx', fileName: 'Senior Citizen Masterlist (monthly).xlsx', kind: 'prepared' },
  'recurring-kp': { file: 'recurring-kp.docx', fileName: 'Katarungang Pambarangay Monthly Report.docx', kind: 'prepared' },
  'recurring-personnel': { file: 'recurring-personnel.docx', fileName: 'BOIS Form (Annex A, Revised 2023).docx', kind: 'official' },
}

export const builtInTemplateUrl = (t: BuiltInReportTemplate) => `${import.meta.env.BASE_URL}report-templates/${t.file}`
