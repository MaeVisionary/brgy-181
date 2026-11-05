import type { ReactNode } from 'react'
import type { FieldValue } from '@/types/document'

/**
 * Certification of Non-Residency: the body paragraphs, re-typeset word for word
 * (including original spacing and spelling) from CERTIFICATION OF NON RESIDENTS.docx,
 * because its blanks sit inside running sentences. Letterhead, signature and footer
 * stay as the original page image. Positions match the original PDF (A4).
 */
export function nonResidencyFlow(_values: Record<string, FieldValue>, blank: (field: string) => ReactNode) {
  const B = ({ children }: { children: ReactNode }) => <b>{children}</b>
  const BU = ({ children, big }: { children: ReactNode; big?: boolean }) => (
    <b style={{ textDecoration: 'underline', fontSize: big ? '16pt' : undefined }}>{children}</b>
  )
  const P = ({ indent, children }: { indent?: number; children: ReactNode }) => (
    <p style={{ margin: 0, textIndent: indent ? `${indent}mm` : undefined }}>{children}</p>
  )
  const Gap = ({ pt = 14 }: { pt?: number }) => <p style={{ margin: 0, fontSize: `${pt}pt`, lineHeight: 1.22 }}>&nbsp;</p>

  return [
    {
      page: 1,
      node: (
        <div
          style={{
            position: 'absolute',
            top: '119.5mm',
            left: '25.4mm',
            width: '159.5mm',
            fontFamily: 'Calibri, Carlito, sans-serif',
            fontSize: '14pt',
            lineHeight: 1.22,
            color: '#0d0d0d',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ textAlign: 'justify' }}>
            <P indent={12.3}>
              <u>T</u>HIS IS TO CERTIFY that  Mr./Ms. <B>{blank('fullName')}</B>
              <BU big>,</BU> of  legal age with a former address  at<BU> </BU>
              <B> </B>
              <BU>{blank('formerAddress')}.</BU>
            </P>
          </div>
          <Gap />
          <P indent={7.4}>
            This further certifies  that the above-mentioned name is <B>no longer a resident</B> in this barangay{'   '}
          </P>
          <Gap />
          <P>
            {'       '}This certification is issued upon the request of  4Ps<B> Pantawid Pamilyang Pilipino Program </B>under{' '}
            <B>DSWD</B>, for any legal purpose it may served.
          </P>
          <Gap pt={12} />
          <P indent={9.9}>
            Issued this <BU>{blank('issueDay')}</BU>day of <B> </B>
            <BU>{blank('issueMonth')}</BU>  Barangay <BU big>181</BU>
            <BU> </BU>Zone <BU big>16</BU>
            <u> </u>District <B>II</B> City of <B>Manila</B>.
          </P>
        </div>
      ),
    },
  ]
}
