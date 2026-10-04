const link = (href, text) => (
  <a href={href} target="_blank" rel="noreferrer">
    {text}
  </a>
)

export default function AboutData() {
  return (
    <div className="panel">
      <h3>Sources</h3>
      <ul>
        <li>
          Stops: {link('https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/main/data/transit-stops-oak-park.csv', 'transit-stops-oak-park.csv')}{' '}
          (Day in Our Data), built from CTA, Pace and Metra GTFS
        </li>
        <li>Route lines: CTA, Pace and Metra GTFS schedule files, clipped to Oak Park</li>
        <li>
          Route hours and frequency (Routes tab): the same GTFS schedules for Wednesday, October 21, Saturday, October 24 and
          Sunday, October 25, 2026
        </li>
        <li>Village boundary: {link('https://tigerweb.geo.census.gov/', 'U.S. Census Bureau TIGERweb')}, Oak Park village</li>
        <li>
          Alerts: {link('https://www.transitchicago.com/developers/alerts/', 'CTA Customer Alerts API')}, refreshed about every 15 minutes
        </li>
        <li>
          Live CTA buses (routes 20, 66, 70, 86, 90, 91, 126):{' '}
          {link('https://www.transitchicago.com/developers/bustracker/', 'CTA Bus Tracker API')}
        </li>
        <li>
          Live CTA trains (Green and Blue Lines): {link('https://www.transitchicago.com/developers/traintracker/', 'CTA Train Tracker API')}
        </li>
        <li>
          Live Pace buses (routes 307, 309, 311, 313, 314, 315, 318): Pace's {link('https://tmweb.pacebus.com/TMWebWatch/', 'Bus Tracker')} map.
          Pace has no official live data feed, so this could stop working without notice.
        </li>
        <li>
          Base map: {link('https://www.esri.com/', 'Esri')} Light and Dark Gray Canvas, with{' '}
          {link('https://www.openstreetmap.org/copyright', 'OpenStreetMap')} contributors
        </li>
      </ul>
      <h3>How the map works</h3>
      <ul>
        <li>Live buses and trains update about every 30 seconds. Trails show where each one went in the last 15 minutes.</li>
        <li>
          Click a CTA station or bus stop to see the next arrivals in each direction. Times marked * come from the schedule
          because CTA isn't tracking that train live.
        </li>
        <li>Only buses and trains within 1/4 mile of the Village line are shown.</li>
        <li>If the live feed is down, the map shows a saved sample in gray and says it isn't live.</li>
        <li>
          "Village only" shows stops in Oak Park plus the ones just across Austin and Harlem, and fades out the map and route
          lines beyond 1/4 mile.
        </li>
        <li>
          Pick a route in the Routes tab to see only that route's line, stops and live vehicles, with its first and last trip
          and how many run each hour in each direction. Hours count trips reaching a stop in or just across the Village.
        </li>
      </ul>
      <h3>Limits</h3>
      <ul>
        <li>The stops file is a snapshot, not a live schedule.</li>
        <li>
          Trip counts in stop popups are for one weekday (September 9, 2026). The Routes tab shows how often each route runs on
          weekdays and weekends.
        </li>
        <li>Route hours come from one sample weekday, Saturday and Sunday. Holidays and schedule changes aren't reflected.</li>
        <li>Pace stop accessibility isn't recorded. "Unknown" doesn't mean inaccessible.</li>
        <li>Arrival times are live for CTA only. The Oak Park Metra station shows scheduled departures, and Pace stops don't show times yet.</li>
        <li>Metra trains aren't shown live, and Pace and Metra alerts aren't included.</li>
        <li>This page doesn't have rider eligibility rules yet.</li>
      </ul>
    </div>
  )
}
