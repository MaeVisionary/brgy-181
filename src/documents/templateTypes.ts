import type { ReactNode } from 'react'
import type { FieldValue } from '@/types/document'

/**
 * A printable template = the official page image(s) exactly as supplied,
 * plus positions (in millimetres from the page's top-left) where values go.
 * Nothing about the original wording or layout is redrawn.
 */

export interface PageSize {
  widthMm: number
  heightMm: number
  /** Human name for the print dialog hint. */
  name: 'A4' | 'Letter' | 'Legal' | 'Folio (8.5 × 13 in)'
}

interface Base {
  page: number
  /** Font for typed values; defaults to the template font. */
  font?: string
  /** Font size in points. */
  size?: number
  bold?: boolean
  underline?: boolean
}

/** Single line of text on a blank. `y` is the blank line's position (mm). */
export interface TextSlot extends Base {
  kind: 'text'
  field: string
  x1: number
  x2: number
  y: number
  align?: 'left' | 'center'
}

/** A check mark drawn when `field` contains `option`. */
export interface CheckSlot extends Base {
  kind: 'check'
  field: string
  option: string
  x: number
  y: number
}

/** Text that wraps across a fixed set of ruled lines (possibly across pages). */
export interface LinesSlot extends Omit<Base, 'page'> {
  kind: 'lines'
  field: string
  x1: number
  x2: number
  /** Each ruled line; x1/x2 override the slot's when a line is shorter (e.g. it follows a label). */
  lines: { page: number; y: number; x1?: number; x2?: number }[]
}

/** Text that wraps inside a box. */
export interface AreaSlot extends Base {
  kind: 'area'
  field: string
  x1: number
  x2: number
  y1: number
  y2: number
}

/** One entry of a list field per ruled line (e.g. "Received by" names). */
export interface ListSlot extends Base {
  kind: 'list'
  field: string
  x1: number
  x2: number
  ys: number[]
}

export type Slot = TextSlot | CheckSlot | LinesSlot | AreaSlot | ListSlot

export interface TemplateSpec {
  pageSize: PageSize
  /** Image per page, under /public. */
  pages: string[]
  /** Default font for typed values (matches the body text of the original). */
  font: string
  size: number
  bold?: boolean
  slots: Slot[]
  /**
   * For documents whose blanks sit inside running sentences: the original
   * paragraphs re-typeset word for word so values flow like they do in Word.
   */
  flow?: (values: Record<string, FieldValue>, blank: (field: string) => ReactNode) => { page: number; node: ReactNode }[]
  /** Source file this template was taken from. */
  source: string
}
