/**
 * BMIS icon set — one place for every icon in the app.
 *
 * Source: Phosphor Icons (https://phosphoricons.com, MIT licence), bundled as SVG
 * React components (no external image URLs). Style rules:
 *  - "duotone" for meaningful icons (navigation, sections, tiles, empty states, alerts):
 *    a clear outline with a soft tinted fill, in the current text colour.
 *  - "bold" for small controls (arrows, carets, check, close, plus, menu, search, spinner)
 *    so they stay crisp at 14–16px.
 * Names match the ones the screens already use, so a screen only imports from '@/icons'.
 * Icons are decorative (aria-hidden) unless an aria-label is passed.
 */
import type { ComponentType, CSSProperties } from 'react'
import {
  ArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowsDownUp,
  Bank,
  Bell as PhBell,
  BellRinging,
  BookOpenText,
  Buildings,
  CalendarCheck,
  CalendarDots,
  Camera as PhCamera,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChartPieSlice,
  Check as PhCheck,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Clock as PhClock,
  ClockCounterClockwise,
  Code,
  Copy as PhCopy,
  Database as PhDatabase,
  DownloadSimple,
  EnvelopeSimple,
  Eye as PhEye,
  EyeSlash,
  FileArrowDown,
  FileArrowUp,
  FilePlus,
  FileText as PhFileText,
  FileXls,
  Files as PhFiles,
  Flask,
  FloppyDisk,
  FunnelX,
  Gavel as PhGavel,
  GearSix,
  Hammer as PhHammer,
  Handshake,
  House,
  IdentificationCard,
  Info as PhInfo,
  Key,
  Lifebuoy,
  List,
  ListChecks,
  LockSimple,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MapPin as PhMapPin,
  Megaphone,
  Notepad,
  Package as PhPackage,
  Paperclip as PhPaperclip,
  PencilSimple,
  Phone as PhPhone,
  Plus as PhPlus,
  Printer as PhPrinter,
  Question,
  Receipt as PhReceipt,
  Scroll,
  SealCheck,
  ShieldCheck as PhShieldCheck,
  ShieldSlash,
  ShieldWarning,
  SignIn,
  SignOut,
  SlidersHorizontal as PhSlidersHorizontal,
  SquaresFour,
  Stamp,
  Toolbox,
  Trash,
  Tray,
  UploadSimple,
  UserCheck as PhUserCheck,
  UserCircle,
  UserGear,
  UserPlus as PhUserPlus,
  UsersThree,
  Wallet as PhWallet,
  Warning,
  WarningCircle,
  X as PhX,
  XCircle as PhXCircle,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react'

export interface IconProps {
  className?: string
  style?: CSSProperties
  /** Accepted for compatibility; 3 and above renders the bold weight. */
  strokeWidth?: number
  'aria-label'?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

/** Kept so existing `LucideIcon` type references keep working. */
export type LucideIcon = ComponentType<IconProps>

function icon(Ph: PhosphorIcon, weight: IconWeight): LucideIcon {
  const C = ({ className, style, strokeWidth, ...aria }: IconProps) => (
    <Ph
      size={24}
      className={className}
      style={style}
      weight={strokeWidth !== undefined && strokeWidth >= 3 ? 'bold' : weight}
      aria-hidden={aria['aria-label'] ? undefined : true}
      {...aria}
    />
  )
  C.displayName = `Icon(${Ph.displayName ?? 'Phosphor'})`
  return C
}

const ui = (Ph: PhosphorIcon) => icon(Ph, 'bold')
// One line style everywhere (no two-tone fills), like SF Symbols.
const mark = (Ph: PhosphorIcon) => icon(Ph, 'bold')

// ── Controls (bold) ────────────────────────────────────────────────
export const ArrowDownUp = ui(ArrowsDownUp)
export const ArrowLeft = ui(PhArrowLeft)
export const ArrowRight = ui(PhArrowRight)
export const Check = ui(PhCheck)
export const ChevronDown = ui(CaretDown)
export const ChevronLeft = ui(CaretLeft)
export const ChevronRight = ui(CaretRight)
export const Loader2 = ui(CircleNotch)
export const Menu = ui(List)
export const Plus = ui(PhPlus)
export const Search = ui(MagnifyingGlass)
export const X = ui(PhX)

// ── Navigation and modules (duotone) ───────────────────────────────
export const LayoutDashboard = mark(SquaresFour)
export const Home = mark(House)
export const Users = mark(UsersThree)
export const UserRound = mark(UserCircle)
export const UserRoundPen = mark(UserGear)
export const UserPlus = mark(PhUserPlus)
export const UserCheck = mark(PhUserCheck)
export const BadgeCheck = mark(SealCheck)
export const IdCard = mark(IdentificationCard)
export const FileText = mark(PhFileText)
export const FilePen = mark(Notepad)
export const FileCheck2 = mark(Stamp)
export const FilePlus2 = mark(FilePlus)
export const FileUp = mark(FileArrowUp)
export const FileDown = mark(FileArrowDown)
export const FileClock = mark(ClockCounterClockwise)
export const FileSpreadsheet = mark(FileXls)
export const Sheet = mark(FileXls)
export const Files = mark(PhFiles)
export const Gavel = mark(PhGavel)
export const CalendarClock = mark(CalendarDots)
export const CalendarCheck2 = mark(CalendarCheck)
export const Boxes = mark(Toolbox)
export const Package = mark(PhPackage)
export const PackagePlus = mark(PhPackage)
export const HandHelping = mark(Handshake)
export const ChartPie = mark(ChartPieSlice)
export const BarChart3 = mark(ChartBar)
export const BookOpenCheck = mark(BookOpenText)
export const ClipboardList = mark(ClipboardText)
export const ClipboardCheck = mark(ListChecks)
export const MessageSquareWarning = mark(Megaphone)
export const MegaphoneIcon = mark(Megaphone)
export const Bell = mark(PhBell)
export const BellRing = mark(BellRinging)
export const Settings2 = mark(GearSix)
export const SlidersHorizontal = mark(PhSlidersHorizontal)
export const ShieldCheck = mark(PhShieldCheck)
export const ShieldX = mark(ShieldSlash)
export const ShieldAlert = mark(ShieldWarning)
export const ScrollText = mark(Scroll)
export const Database = mark(PhDatabase)
export const Wallet = mark(PhWallet)
export const Receipt = mark(PhReceipt)
export const ReceiptText = mark(PhReceipt)
export const Landmark = mark(Bank)
export const Building2 = mark(Buildings)
export const Hammer = mark(PhHammer)
export const FlaskConical = mark(Flask)
export const Code2 = mark(Code)
export const LifeBuoy = mark(Lifebuoy)
export const LogIn = mark(SignIn)
export const LogOut = mark(SignOut)

// ── Actions, states and details (duotone) ─────────────────────────
export const AlertCircle = mark(WarningCircle)
export const CircleAlert = mark(WarningCircle)
export const AlertTriangle = mark(Warning)
export const CheckCircle2 = mark(CheckCircle)
export const XCircle = mark(PhXCircle)
export const CircleHelp = mark(Question)
export const Info = mark(PhInfo)
export const Inbox = mark(Tray)
export const SearchX = mark(MagnifyingGlassMinus)
export const FilterX = mark(FunnelX)
export const Eye = mark(PhEye)
export const EyeOff = mark(EyeSlash)
export const KeyRound = mark(Key)
export const Lock = mark(LockSimple)
export const Save = mark(FloppyDisk)
export const Printer = mark(PhPrinter)
export const Download = mark(DownloadSimple)
export const Upload = mark(UploadSimple)
export const Paperclip = mark(PhPaperclip)
export const Pencil = mark(PencilSimple)
export const Trash2 = mark(Trash)
export const RotateCcw = mark(ArrowCounterClockwise)
export const Copy = mark(PhCopy)
export const Mail = mark(EnvelopeSimple)
export const Phone = mark(PhPhone)
export const MapPin = mark(PhMapPin)
export const Clock = mark(PhClock)
export const Camera = mark(PhCamera)
