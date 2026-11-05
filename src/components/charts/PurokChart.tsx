import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions, type Plugin } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { PurokBreakdown } from '@/services/residentService'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const NAVY = '#002132'
const SKY = '#accee1'

/** Draws the resident count above each navy bar (figma). */
const valueLabels: Plugin<'bar'> = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    ctx.save()
    ctx.font = '600 11px Inter, sans-serif'
    ctx.fillStyle = NAVY
    ctx.textAlign = 'center'
    meta.data.forEach((bar, i) => {
      const v = chart.data.datasets[0].data[i]
      ctx.fillText(String(v), bar.x, bar.y - 6)
    })
    ctx.restore()
  },
}

export function PurokChart({ data }: { data: PurokBreakdown[] }) {
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 18 } },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: NAVY, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } },
    },
    scales: {
      x: { grid: { display: false }, border: { color: '#d6d9de' }, ticks: { color: '#687280', font: { family: 'Inter', size: 11 } } },
      y: { display: false, beginAtZero: true },
    },
    datasets: { bar: { borderRadius: { topLeft: 2, topRight: 2 }, categoryPercentage: 0.62, barPercentage: 0.9 } },
  }

  return (
    <div>
      <div className="h-[220px]" role="img" aria-label="Residents and households per purok">
        <Bar
          options={options}
          plugins={[valueLabels]}
          data={{
            labels: data.map((d) => d.purok),
            datasets: [
              { label: 'Residents', data: data.map((d) => d.residents), backgroundColor: NAVY },
              { label: 'Households', data: data.map((d) => d.households), backgroundColor: SKY },
            ],
          }}
        />
      </div>
      <div className="mt-3 flex gap-5 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-navy-900" /> Residents
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-sky-300" /> Households
        </span>
      </div>
    </div>
  )
}
