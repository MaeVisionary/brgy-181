import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { DocumentTypeDef } from '@/documents/catalog'
import type { FieldValue } from '@/types/document'
import { DocumentPages } from './DocumentPages'

/**
 * Hidden on screen; during printing it is the only thing on the page.
 * Paper size comes from the template (A4, Letter, Legal or Folio), margins 0,
 * so the browser's "Save as PDF" output matches the original layout.
 */
export function PrintPortal({ type, values }: { type: DocumentTypeDef; values: Record<string, FieldValue> }) {
  const { widthMm, heightMm } = type.template.pageSize

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.bmisPrint = ''
    style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`
    document.head.appendChild(style)
    return () => style.remove()
  }, [widthMm, heightMm])

  return createPortal(
    <div className="bmis-print-root">
      <DocumentPages type={type} values={values} mode="print" />
    </div>,
    document.body,
  )
}
