import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import writeXlsxFile from 'write-excel-file/browser'
import { BARANGAY } from '@/config/barangay'

/**
 * PDF and Excel export for INTERNAL analytics reports. These are not official
 * government formats; every file says so in its header.
 */

export interface ReportOutput {
  title: string
  /** Lines shown under the title (source dataset, reporting date, filters…). */
  meta: [string, string][]
  summary: [string, string | number][]
  columns: string[]
  rows: (string | number)[][]
  note?: string
}

const INTERNAL = 'INTERNAL ANALYTICS REPORT: not an official government submission'

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')

export function exportPdf(r: ReportOutput) {
  const landscape = r.columns.length > 6
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`BARANGAY ${BARANGAY.number}, ZONE ${BARANGAY.zone}, DISTRICT ${BARANGAY.district}, CITY OF MANILA`, w / 2, 14, { align: 'center' })
  doc.setFontSize(14)
  doc.text(r.title.toUpperCase(), w / 2, 22, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(194, 39, 0)
  doc.text(INTERNAL, w / 2, 27, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  let y = 34
  doc.setFontSize(9)
  for (const [k, v] of r.meta) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}:`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(v), 52, y, { maxWidth: w - 66 })
    y += 5
  }
  if (r.summary.length) {
    autoTable(doc, {
      startY: y + 2,
      head: [['Summary', 'Value']],
      body: r.summary.map(([k, v]) => [k, String(v)]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [0, 33, 50] },
      tableWidth: Math.min(120, w - 28),
      margin: { left: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }
  if (r.rows.length) {
    autoTable(doc, {
      startY: y + 2,
      head: [r.columns],
      body: r.rows.map((row) => row.map(String)),
      theme: 'grid',
      styles: { fontSize: landscape ? 7 : 8, cellPadding: 1.4 },
      headStyles: { fillColor: [0, 33, 50] },
      margin: { left: 14, right: 14 },
    })
  }
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(104, 114, 128)
    doc.text(`${INTERNAL} · Page ${i} of ${pages}`, w / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
  }
  if (r.note) {
    doc.setPage(pages)
  }
  doc.save(`${safeName(r.title)}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function exportExcel(r: ReportOutput) {
  const bold = { fontWeight: 'bold' as const }
  const sheet: { value: string | number; fontWeight?: 'bold' }[][] = [
    [{ value: `BARANGAY ${BARANGAY.number}, ZONE ${BARANGAY.zone}, DISTRICT ${BARANGAY.district}, CITY OF MANILA`, ...bold }],
    [{ value: r.title.toUpperCase(), ...bold }],
    [{ value: INTERNAL }],
    [],
    ...r.meta.map(([k, v]) => [{ value: k, ...bold }, { value: String(v) }]),
    [],
  ]
  if (r.summary.length) {
    sheet.push([{ value: 'Summary', ...bold }, { value: 'Value', ...bold }])
    for (const [k, v] of r.summary) sheet.push([{ value: k }, { value: v }])
    sheet.push([])
  }
  if (r.rows.length) {
    sheet.push(r.columns.map((c) => ({ value: c, ...bold })))
    for (const row of r.rows) sheet.push(row.map((v) => ({ value: v })))
  }
  await writeXlsxFile(sheet as never, { fileName: `${safeName(r.title)}_${new Date().toISOString().slice(0, 10)}.xlsx` } as never)
}
