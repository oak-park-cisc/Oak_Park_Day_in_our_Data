// Loaded on demand from RoutesPanel so Recharts stays out of the main bundle
import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { every, hourLabel, hourRange } from './hours'

function FrequencyTip({ active, payload, unit, units }) {
  if (!active || !payload?.length) return null
  const { h, n } = payload[0].payload
  return (
    <div className="chart-tip">
      <b>{hourRange(h)}</b>
      <span>
        {n} {n === 1 ? unit : units} · {every(n)}
      </span>
    </div>
  )
}

// Trips per hour as a smoothed, filled curve. yMax is shared across a route's
// directions so their charts compare at a glance.
export default function FrequencyChart({ hourly, firstHour, color, yMax, unit, units }) {
  const id = useId()
  const data = hourly.map((n, i) => ({ h: firstHour + i, n }))
  return (
    <div className="freq-chart" role="img" aria-label={`${units} per hour through the day`}>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="h"
            type="number"
            domain={[firstHour, firstHour + hourly.length - 1]}
            ticks={[5, 9, 13, 17, 21, 25].filter((t) => t >= firstHour)}
            tickFormatter={hourLabel}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
          />
          <YAxis
            domain={[0, yMax]}
            allowDecimals={false}
            tickCount={3}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<FrequencyTip unit={unit} units={units} />} cursor={{ stroke: 'var(--border-strong)' }} />
          <Area type="monotone" dataKey="n" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
