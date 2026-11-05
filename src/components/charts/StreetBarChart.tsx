import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions, type Plugin } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const NAVY = '#002132'
const SKY = '#accee1'

/** Writes each value at the end of its bar. */
const endLabels: Plugin<'bar'> = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '600 11px Inter, sans-serif'
    ctx.fillStyle = NAVY
    ctx.textBaseline = 'middle'
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      ctx.fillText(String(chart.data.datasets[0].data[i]), bar.x + 6, bar.y)
    })
    ctx.restore()
  },
}

/** One street: horizontal bars for each population figure. */
export function StreetBarChart({ street, items }: { street: string; items: [string, number][] }) {
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 28 } },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: NAVY } },
    scales: {
      x: { display: false, beginAtZero: true },
      y: { grid: { display: false }, border: { color: '#d6d9de' }, ticks: { color: '#3e4650', font: { family: 'Inter', size: 12 } } },
    },
    datasets: { bar: { borderRadius: 3, categoryPercentage: 0.7, barPercentage: 0.9 } },
  }
  return (
    <div className="h-[260px]" role="img" aria-label={`Population figures for ${street}`}>
      <Bar
        options={options}
        plugins={[endLabels]}
        data={{
          labels: items.map(([k]) => k),
          datasets: [{ label: street, data: items.map(([, v]) => v), backgroundColor: items.map((_, i) => (i < 3 ? NAVY : SKY)) }],
        }}
      />
    </div>
  )
}
