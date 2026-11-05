import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

/** Single-series bar chart; clicking a bar reports its label (for drill-down filters). */
export function SimpleBar({
  labels,
  values,
  onSelect,
  selected,
  horizontal,
  height = 220,
  label = 'Records',
}: {
  labels: string[]
  values: number[]
  onSelect?: (label: string) => void
  selected?: string
  horizontal?: boolean
  height?: number
  label?: string
}) {
  const colors = labels.map((l) => (!selected || l === selected ? '#002132' : '#accee1'))
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#002132' } },
    scales: {
      x: { grid: { display: !!horizontal, color: '#e8eaed' }, ticks: { color: '#687280', font: { family: 'Inter', size: 11 } }, beginAtZero: true },
      y: { grid: { display: !horizontal, color: '#e8eaed' }, ticks: { color: '#4a4f57', font: { family: 'Inter', size: 11 }, precision: 0 }, beginAtZero: true },
    },
    onClick: (_e, els) => {
      if (onSelect && els[0]) onSelect(labels[els[0].index])
    },
    onHover: (e, els) => {
      const t = e.native?.target as HTMLElement | undefined
      if (t && onSelect) t.style.cursor = els.length ? 'pointer' : 'default'
    },
    datasets: { bar: { borderRadius: 3, maxBarThickness: 46 } },
  }
  return (
    <div style={{ height }} role="img" aria-label={`${label}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`}>
      <Bar options={options} data={{ labels, datasets: [{ label, data: values, backgroundColor: colors }] }} />
    </div>
  )
}
