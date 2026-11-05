import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DocumentTypeDef } from '@/documents/catalog'
import { isFilled } from '@/documents/fill'
import type { Slot, TemplateSpec } from '@/documents/templateTypes'
import type { FieldValue } from '@/types/document'

/**
 * Draws the official template pages at true physical size (mm) with values
 * placed on their blanks. `mode="screen"` adds highlights for missing details;
 * `mode="print"` outputs only what goes on paper.
 */

const PT_MM = 25.4 / 72
const MM_PX = 96 / 25.4
const MIN_SCALE = 0.55

let canvas: HTMLCanvasElement | null = null
function textWidthMm(text: string, family: string, sizePt: number, bold: boolean): number {
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${bold ? 700 : 400} ${(sizePt * 96) / 72}px ${family}`
  return ctx.measureText(text).width / MM_PX
}

/** Largest size ≤ base that fits the width (down to MIN_SCALE × base). */
function fitSize(text: string, widthMm: number, family: string, base: number, bold: boolean) {
  let size = base
  while (size > base * MIN_SCALE && textWidthMm(text, family, size, bold) > widthMm) size -= 0.25
  return { size, overflow: textWidthMm(text, family, size, bold) > widthMm + 0.5 }
}

/** Greedy word wrap into lines of the given widths. */
function wrap(text: string, widths: number[], family: string, size: number, bold: boolean) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    const limit = widths[Math.min(lines.length, widths.length - 1)]
    if (current && textWidthMm(candidate, family, size, bold) > limit) {
      lines.push(current)
      current = w
    } else current = candidate
  }
  if (current) lines.push(current)
  return { lines: lines.slice(0, widths.length), overflow: lines.length > widths.length }
}

const asText = (v: FieldValue | undefined) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? '' : (v ?? ''))

interface Props {
  type: DocumentTypeDef
  values: Record<string, FieldValue>
  mode: 'screen' | 'print'
  /** Field keys that are required and missing. */
  missing?: Set<string>
  /** Outline every slot (template inspection view). */
  showSlots?: boolean
  /** Message shown in empty system slots (e.g. "Set on approval"). */
  pendingSystemLabel?: string
}

export function DocumentPages(props: Props) {
  const { type } = props
  const tpl = type.template
  return (
    <>
      {tpl.pages.map((src, i) => (
        <Page key={src} {...props} tpl={tpl} pageNo={i + 1} src={src} />
      ))}
    </>
  )
}

function Page({ type, values, mode, missing, showSlots, pendingSystemLabel, tpl, pageNo, src }: Props & { tpl: TemplateSpec; pageNo: number; src: string }) {
  const fieldDefs = Object.fromEntries(type.fields.map((f) => [f.key, f]))
  const screen = mode === 'screen'

  const flow = tpl.flow?.(values, (field) => {
    const v = asText(values[field])
    if (v) return v
    return screen ? <Hole label={fieldDefs[field]?.label ?? field} system={fieldDefs[field]?.by === 'system'} inline /> : '    '
  })

  return (
    <div
      className="bmis-doc-page"
      style={{
        position: 'relative',
        width: `${tpl.pageSize.widthMm}mm`,
        height: `${tpl.pageSize.heightMm}mm`,
        background: '#fff',
        overflow: 'hidden',
        color: '#000',
      }}
    >
      <img src={src} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {flow?.filter((f) => f.page === pageNo).map((f, i) => <div key={i}>{f.node}</div>)}
      {tpl.slots.map((slot, i) => (
        <SlotView
          key={i}
          slot={slot}
          pageNo={pageNo}
          tpl={tpl}
          value={slot.kind === 'static' ? slot.text : values[slot.field]}
          screen={screen}
          isMissing={slot.kind !== 'static' && !!missing?.has(slot.field)}
          isSystemEmpty={slot.kind !== 'static' && fieldDefs[slot.field]?.by === 'system' && !isFilled(values[slot.field])}
          label={slot.kind === 'static' ? '' : (fieldDefs[slot.field]?.label ?? slot.field)}
          showSlots={showSlots}
          pendingSystemLabel={pendingSystemLabel}
        />
      ))}
    </div>
  )
}

function Hole({ label, system, inline, style }: { label: string; system?: boolean; inline?: boolean; style?: CSSProperties }) {
  return (
    <span
      data-hole
      title={label}
      style={{
        display: inline ? 'inline-block' : 'block',
        minWidth: inline ? '12mm' : undefined,
        background: system ? 'rgba(29,95,134,0.10)' : 'rgba(255,51,0,0.10)',
        outline: `0.3mm dashed ${system ? '#1d5f86' : '#ff3300'}`,
        borderRadius: '0.6mm',
        color: system ? '#1d5f86' : '#c22700',
        fontFamily: 'Inter, sans-serif',
        fontSize: '6.5pt',
        fontWeight: 600,
        lineHeight: 1.2,
        padding: '0 0.8mm',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textIndent: 0,
        verticalAlign: 'baseline',
        ...style,
      }}
    >
      {label}
    </span>
  )
}

function SlotView({
  slot,
  pageNo,
  tpl,
  value,
  screen,
  isMissing,
  isSystemEmpty,
  label,
  showSlots,
  pendingSystemLabel,
}: {
  slot: Slot
  pageNo: number
  tpl: TemplateSpec
  value: FieldValue | undefined
  screen: boolean
  isMissing: boolean
  isSystemEmpty: boolean
  label: string
  showSlots?: boolean
  pendingSystemLabel?: string
}) {
  const family = slot.font ?? tpl.font
  const base = slot.size ?? tpl.size
  const bold = slot.bold ?? tpl.bold ?? false
  const textStyle: CSSProperties = {
    position: 'absolute',
    fontFamily: family,
    fontWeight: bold ? 700 : 400,
    textDecoration: slot.underline ? 'underline' : undefined,
    color: '#000',
    whiteSpace: 'nowrap',
  }
  const outline: CSSProperties | undefined = showSlots ? { outline: '0.25mm solid rgba(29,95,134,0.55)', background: 'rgba(29,95,134,0.06)' } : undefined

  if (slot.kind === 'check') {
    if (slot.page !== pageNo) return null
    const on = Array.isArray(value) ? value.includes(slot.option) : value === true ? slot.option === 'true' : value === slot.option
    if (!on && !showSlots) return null
    return (
      <span
        style={{
          ...textStyle,
          left: `${slot.x - 2}mm`,
          top: `${slot.y - 2.6}mm`,
          width: '4mm',
          height: '5mm',
          lineHeight: '5mm',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
          fontSize: `${slot.size ?? 11}pt`,
          ...outline,
        }}
      >
        {on ? '✓' : ''}
      </span>
    )
  }

  if (slot.kind === 'text' || slot.kind === 'static') {
    if (slot.page !== pageNo) return null
    const text = asText(value)
    const width = slot.x2 - slot.x1
    const { size } = text ? fitSize(text, width, family, base, bold) : { size: base }
    const lineH = base * PT_MM * 1.18
    const box: CSSProperties = { left: `${slot.x1}mm`, width: `${width}mm`, top: `${slot.y - lineH - 0.25}mm`, height: `${lineH}mm` }
    if (!text) {
      if (!screen || !(isMissing || isSystemEmpty || showSlots)) return null
      return (
        <div style={{ position: 'absolute', ...box, display: 'flex', alignItems: 'flex-end', paddingBottom: '0.4mm' }}>
          <Hole label={isSystemEmpty ? `${label}: ${pendingSystemLabel ?? 'set automatically'}` : label} system={isSystemEmpty || (showSlots && !isMissing)} style={{ width: '100%' }} />
        </div>
      )
    }
    return (
      <div style={{ ...textStyle, ...box, fontSize: `${size}pt`, lineHeight: `${lineH}mm`, textAlign: slot.align ?? 'left', ...outline }}>{text}</div>
    )
  }

  if (slot.kind === 'lines') {
    const text = asText(value)
    const lines = slot.lines.map((l) => ({ ...l, x1: l.x1 ?? slot.x1, x2: l.x2 ?? slot.x2 }))
    const lineH = base * PT_MM * 1.18
    if (!text) {
      if (!screen || !(isMissing || showSlots)) return null
      const first = lines[0]
      if (first.page !== pageNo) return null
      return (
        <div style={{ position: 'absolute', left: `${first.x1}mm`, width: `${first.x2 - first.x1}mm`, top: `${first.y - lineH - 0.25}mm`, height: `${lineH}mm`, display: 'flex', alignItems: 'flex-end' }}>
          <Hole label={label} system={showSlots && !isMissing} style={{ width: '100%' }} />
        </div>
      )
    }
    const { lines: wrapped, overflow } = wrap(text, lines.map((l) => l.x2 - l.x1), family, base, bold)
    return (
      <>
        {wrapped.map((line, i) =>
          lines[i].page !== pageNo ? null : (
            <div
              key={i}
              style={{
                ...textStyle,
                left: `${lines[i].x1}mm`,
                width: `${lines[i].x2 - lines[i].x1}mm`,
                top: `${lines[i].y - lineH - 0.25}mm`,
                height: `${lineH}mm`,
                lineHeight: `${lineH}mm`,
                fontSize: `${base}pt`,
                ...outline,
              }}
            >
              {line}
            </div>
          ),
        )}
        {overflow && screen && lines[lines.length - 1].page === pageNo && (
          <Overflow x={lines[lines.length - 1].x2} y={lines[lines.length - 1].y} />
        )}
      </>
    )
  }

  if (slot.kind === 'list') {
    if (slot.page !== pageNo) return null
    const items = asText(value).split('\n').map((s) => s.trim()).filter(Boolean)
    const lineH = base * PT_MM * 1.18
    if (items.length === 0) {
      if (!screen || !showSlots) return null
    }
    return (
      <>
        {slot.ys.map((y, i) =>
          items[i] || showSlots ? (
            <div
              key={i}
              style={{ ...textStyle, left: `${slot.x1}mm`, width: `${slot.x2 - slot.x1}mm`, top: `${y - lineH - 0.25}mm`, height: `${lineH}mm`, lineHeight: `${lineH}mm`, fontSize: `${items[i] ? fitSize(items[i], slot.x2 - slot.x1, family, base, bold).size : base}pt`, ...outline }}
            >
              {items[i] ?? ''}
            </div>
          ) : null,
        )}
      </>
    )
  }

  // area
  if (slot.page !== pageNo) return null
  const text = asText(value)
  const box: CSSProperties = { left: `${slot.x1}mm`, top: `${slot.y1}mm`, width: `${slot.x2 - slot.x1}mm`, height: `${slot.y2 - slot.y1}mm` }
  if (!text) {
    if (!screen || !(isMissing || showSlots)) return null
    return (
      <div style={{ position: 'absolute', ...box }}>
        <Hole label={label} system={showSlots && !isMissing} style={{ width: '100%', height: '100%', whiteSpace: 'normal' }} />
      </div>
    )
  }
  return <AreaText style={{ ...textStyle, ...box, fontSize: `${base}pt`, whiteSpace: 'pre-wrap', lineHeight: 1.25, overflow: 'hidden', ...outline }} screen={screen} text={text} />
}

function AreaText({ style, text, screen }: { style: CSSProperties; text: string; screen: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setOver(el.scrollHeight > el.clientHeight + 1)
  }, [text])
  return (
    <div ref={ref} style={style}>
      {text}
      {over && screen && <Overflow inline />}
    </div>
  )
}

function Overflow({ x, y, inline }: { x?: number; y?: number; inline?: boolean }): ReactNode {
  const s: CSSProperties = {
    background: '#ff3300',
    color: '#fff',
    fontFamily: 'Inter, sans-serif',
    fontSize: '6pt',
    fontWeight: 700,
    padding: '0.3mm 1mm',
    borderRadius: '0.6mm',
    whiteSpace: 'nowrap',
  }
  return inline ? (
    <span style={{ ...s, position: 'absolute', right: 0, bottom: 0 }}>Text continues beyond the space on the form</span>
  ) : (
    <span style={{ ...s, position: 'absolute', left: `${(x ?? 0) - 52}mm`, top: `${(y ?? 0) + 0.8}mm` }}>Text continues beyond the lines on the form</span>
  )
}

/** Scales physical-size pages to fit their container on screen. */
export function ScaledPages({ children, pageWidthMm }: { children: ReactNode; pageWidthMm: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(Math.min(1.1, el.clientWidth / (pageWidthMm * MM_PX)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageWidthMm])
  return (
    <div ref={ref} className="w-full">
      <div style={{ zoom: scale }} className="flex flex-col items-center gap-6 [&_.bmis-doc-page]:shadow-[0_1px_4px_rgba(0,33,50,0.18)]">
        {children}
      </div>
    </div>
  )
}
