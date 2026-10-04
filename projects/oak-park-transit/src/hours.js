// Hour formatting for route schedules. Hours past 23 are after midnight (25 = 1 a.m.).

const twelve = (h) => (h % 24) % 12 || 12
const half = (h) => (h % 24 < 12 ? 'a' : 'p')

export const hourLabel = (h) => `${twelve(h)}${half(h)}`

export const hourRange = (h) => `${twelve(h)} ${half(h)}.m.–${twelve(h + 1)} ${half(h + 1)}.m.`

export const every = (perHour) => (perHour ? `every ~${Math.max(1, Math.round(60 / perHour))} min` : 'no trips')
