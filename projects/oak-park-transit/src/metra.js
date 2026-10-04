// Scheduled Metra departures at Oak Park, from public/data/metra-oak-park.json
// (scripts/build_metra.py). Works in Chicago time whatever the viewer's zone.

const base = import.meta.env.BASE_URL
let schedule

export function loadMetraSchedule() {
  schedule ??= fetch(base + 'data/metra-oak-park.json').then((r) => {
    if (!r.ok) throw new Error(`Metra schedule ${r.status}`)
    return r.json()
  })
  return schedule
}

// Chicago date (YYYYMMDD), weekday (0 = Monday) and minutes after midnight
function chicagoNow(at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return {
    ymd: `${parts.year}${parts.month}${parts.day}`,
    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

function activeServices(data, ymd, weekday) {
  const on = new Set(
    Object.entries(data.services)
      .filter(([, s]) => s.start <= ymd && ymd <= s.end && s.days[weekday])
      .map(([id]) => id),
  )
  const ex = data.exceptions[ymd]
  ex?.add.forEach((id) => on.add(id))
  ex?.remove.forEach((id) => on.delete(id))
  return on
}

// Next `count` departures per direction, soonest first:
// [{ direction: 1 | 0, headsign, minutesAway, clock }]
export function nextDepartures(data, count = 3, at = new Date()) {
  const now = chicagoNow(at)
  const yesterday = chicagoNow(new Date(at.getTime() - 86_400_000))
  const today = activeServices(data, now.ymd, now.weekday)
  const late = activeServices(data, yesterday.ymd, yesterday.weekday)

  const upcoming = []
  for (const [mins, sid, direction, headsign] of data.departures) {
    if (today.has(sid) && mins >= now.minutes) upcoming.push({ mins, direction, headsign })
    // Trips from yesterday's schedule that run past midnight (GTFS times over 24:00)
    if (late.has(sid) && mins >= 1440 && mins - 1440 >= now.minutes) upcoming.push({ mins: mins - 1440, direction, headsign })
  }
  upcoming.sort((a, b) => a.mins - b.mins)

  const byDir = { 1: [], 0: [] }
  for (const d of upcoming) {
    if (byDir[d.direction].length < count) {
      const h = Math.floor(d.mins / 60) % 24
      byDir[d.direction].push({
        ...d,
        minutesAway: d.mins - now.minutes,
        clock: `${h % 12 || 12}:${String(d.mins % 60).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`,
      })
    }
  }
  return byDir
}
