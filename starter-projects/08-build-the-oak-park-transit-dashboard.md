# Build the Oak Park transit dashboard

**Civic question:** Can one page help a resident understand Oak Park's transit stops, routes, and transportation providers?

**Minimum viable demo:**

- A static map using `transit-stops-oak-park.csv`, colored by provider, with stop names, routes, and recorded accessibility information. Show unknown values explicitly.
- A short provider guide linking CTA rail/bus, Pace bus, Metra, Pace ADA paratransit, and Township transportation to their official rider-information pages below. A map and a six-row guide are a complete demo.
- Optionally show the cached bikeways layer as planning context, clearly labeled as not a verified inventory of built facilities.

**Stretch goals:**

- Add live arrivals for one provider only after organizers have obtained credentials, tested a proxy, and prepared a cached response for outages. Live feeds are not required for the MVP.
- Add service span/headway from a prepared GTFS extract, or elevator alerts from CTA's feed. Neither is in the cached stops file.
- Research eligibility for paratransit and Township rides against current provider pages before adding a "who can ride" filter.
- Chart station ridership using `cta-ridership-oak-park.csv`; bus ridership is whole-route, not local-stop ridership.
- Explore transit and zoning with additional zoning polygons (see [Transit and Zoning Opportunity Explorer](../project-ideas.md#9-transit-and-zoning-opportunity-explorer)), or make a printable guide for a few destinations.

**Data:**

- CTA schedule: [GTFS](https://www.transitchicago.com/developers/gtfs/), zip at `https://www.transitchicago.com/downloads/sch_data/google_transit.zip` (about 100 MB, no key)
- CTA real time: [Bus Tracker API](https://www.transitchicago.com/developers/bustracker/) ([key form](https://www.ctabustracker.com/bustime/apps/getapikey.jsp), [developer guide PDF](https://www.transitchicago.com/assets/1/6/cta_Bus_Tracker_API_Developer_Guide_and_Documentation_2025-04-21.pdf)) and [Train Tracker API](https://www.transitchicago.com/developers/traintracker/) ([apply](https://www.transitchicago.com/developers/traintrackerapply/), [docs](https://www.transitchicago.com/developers/ttdocs/)); index at the [Developer Center](https://www.transitchicago.com/developers/)
- CTA accessibility: [Customer Alerts API](https://www.transitchicago.com/developers/alerts/), no key, elevator outages at `https://www.transitchicago.com/api/1.0/alerts.aspx?accessibility=true&activeonly=true&outputType=JSON`; [accessibility status page](https://www.transitchicago.com/travel-information/accessibility-status/); [List of 'L' Stops](https://data.cityofchicago.org/Transportation/CTA-System-Information-List-of-L-Stops/8pix-ypme) with an `ada` flag (true only for Harlem/Lake among Oak Park stations)
- CTA ridership: [L Station Entries, Daily Totals](https://data.cityofchicago.org/Transportation/CTA-Ridership-L-Station-Entries-Daily-Totals/5neh-572f) (`https://data.cityofchicago.org/resource/5neh-572f.json`) and [Bus Routes, Monthly Day-Type Averages](https://data.cityofchicago.org/Transportation/CTA-Ridership-Bus-Routes-Monthly-Day-Type-Averages/bynn-gwxy) (`https://data.cityofchicago.org/resource/bynn-gwxy.json`); no stop-level bus ridership
- Pace schedule: [GTFS page](https://www.pacebus.com/gtfs), August 2026 zip at `https://www.pacebus.com/sites/default/files/2026-08/GTFS.zip` (8 MB, no key, [non-commercial license](https://www.pacebus.com/route-timetable-data-services))
- Pace real time: no GTFS-realtime feed and no documented API ([Bus Tracker tools](https://www.pacebus.com/bus-tracker-tools)); the web [Bus Tracker](https://tmweb.pacebus.com/TMWebWatch/) uses undocumented JSON under `https://tmweb.pacebus.com/TMWebWatch/Arrivals.aspx/` (`getRoutes`, `getDirections`, `getStops`, `getStopTimes`; route ids 307=33, 309=35, 311=37, 313=38, 314=271, 315=39, 318=41)
- Pace accessibility: [riders with disabilities](https://www.pacebus.com/riders-disabilities), [ADA Paratransit](https://www.pacebus.com/ada), [West Suburban Cook reservation line](https://www.pacebus.com/directory/paratransit-reservation-line-west-suburban-cook-county), [Taxi Access Program](https://www.pacebus.com/tap), [Cook County Dial-a-Ride](https://www.pacebus.com/dial-ride-services-cook-county) and [Pace On Demand](https://www.pacebus.com/ondemand) (neither covers Oak Park)
- Pace ridership: stop-level counts in the cached stops file; route history at [RTAMS, Pace ridership by route](https://www.rtams.org/ridership/pace/routes)
- Metra schedule: [developers page](https://metra.com/developers), GTFS zip at `https://schedules.metrarail.com/gtfs/schedule.zip` (no key, under 1 MB; `https://schedules.metrarail.com/gtfs/published.txt` shows the change date; station `stop_id` is `OAKPARK`)
- Metra real time: GTFS-realtime `alerts`, `positions`, and `tripupdates` (obtain current endpoint URLs from the API documentation) with an `api_token` ([API page](https://metra.com/metra-gtfs-api), free key via the developers page after the [license](https://metra.com/gtfs-realtime-api-key-request-license-agreement)); Protocol Buffers, must be proxied
- Metra accessibility and ridership: [Oak Park station page](https://metra.com/train-lines/stations/oak-park), [Accessibility at Metra](https://metra.com/accessibility), [monthly reports by line](https://metra.com/ridership-and-on-time-performance), [fall 2018 boarding count](https://metra.com/document/2018summaryresultsreportfinalpdf), [RTAMS, Metra ridership by station](https://www.rtams.org/ridership/metra/stations)
- Oak Park Township: [Senior Services page](https://oakparktownship.org/senior-services/) (curb-to-curb lift-equipped rides for residents 60 and over and adults with a disability, (708) 383-4806, taxi coupon books; no schedule, hours, or ridership published); Village [Transportation page](https://www.oak-park.us/Services-Parking/Transportation) lists no Village-run shuttle
- Bikes and other: Divvy has no Oak Park stations (GBFS `https://gbfs.divvybikes.com/gbfs/gbfs.json` points to `https://gbfs.lyft.com/gbfs/1.1/chi/en/station_information.json`, zero stations inside the Village box; [contract ended January 2018](https://chi.streetsblog.org/2018/01/17/for-whom-the-bike-bell-tolls-oak-park-votes-to-kill-its-divvy-program)); Amtrak nearest is [La Grange Road](https://www.amtrak.com/stations/lag); Pace [I-290 and I-88 express study](https://www.pacebus.com/I-290-I-88-study) has no route yet
- Bikeways: [Oak Park Bikeways July 2025 GeoJSON](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Oak_Park_Bikeways_July_2025/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson) (also in [brief 04](04-can-a-kid-bike-to-school-safely.md))
- Cached in this repo: [transit-stops-oak-park.csv](../data/transit-stops-oak-park.csv) (CTA and Pace bus stops plus CTA and Metra rail stations in and just across the Village line, 225 rows, 147 with `in_oak_park` = Y; columns documented in brief 06)
- Cached in this repo: [cta-ridership-oak-park.csv](../data/cta-ridership-oak-park.csv) (daily rail station entries since 2015 and monthly bus route averages for the Oak Park routes, through June 2026, 30,359 rows; `python3 data/scripts/fetch_cta_ridership_oak_park.py --since 2001` for the full history)
- Cached in this repo: [social-vulnerability-oak-park.geojson](../data/social-vulnerability-oak-park.geojson) (53 block groups scored 1 to 5 on `Senior_Index`, `Disability_Index`, `LackOfVehicle_Index` and twelve more; see brief 06)

- Cached in this repo: [bikeways-oak-park.geojson](../data/bikeways-oak-park.geojson) (85 planning-network segments; phase flags do not verify built status)

**Potential users:** Village staff asked for this; Transportation Commission, riders, seniors and ADA-certified residents, Township Senior Services

**Difficulty:** Intermediate for the static demo; advanced for live feeds

**Readiness:** Ready now for the static stop/route map and provider guide. Live-arrival extensions require organizer preparation: working API credentials, a tested proxy, and a cached fallback before the event.

**No-code roles:** Own the provider table and check every cell against the provider's page, survey five riders at the Green Line or Metra platform, call the Township to write up what its program does and does not publish, and own the demo.

**Limits:** The stops file is a snapshot, not a live schedule. `weekday_trips` uses September 9, 2026 and is not a headway or Saturday service estimate. No span/headway, provider eligibility, live arrivals, or elevator status is cached. Pace accessibility is unknown in this file; do not treat a blank as inaccessible. The undocumented Pace interface may change; protect keyed feeds with a server-side proxy and check current provider documentation before enabling extensions.
