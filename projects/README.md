# Day in Our Data 2026 projects

Archived code and links for the apps teams built at Day in Our Data. **Try them:** https://oak-park-cisc.github.io/Oak_Park_Day_in_our_Data/

| Project | Team | Code or demo |
|---|---|---|
| Lorax | Lorax team | [projects/lorax](lorax) |
| Lorax — alison's version | alison b | [projects/lorax-alison](lorax-alison) |
| Report Card Oak Park | Report Card Oak Park team | [projects/report-card-oak-park](report-card-oak-park) |
| Urban Forest Diversity | Urban Forest Diversity team | [projects/urban-forest-diversity](urban-forest-diversity) |
| Presettlement Oaks | Presettlement Oaks team | [projects/presettlement-oaks](presettlement-oaks) |
| Survivor: Oak Park | Team Wesley | [projects/team-wesley](team-wesley) |
| Oak Park Transit | Oak Park Transit Team | [projects/oak-park-transit](oak-park-transit) · [team repo](https://github.com/CaptainChemist/oak-park-transit-tracker) |
| What ECHO Sees | Team ECHO | [projects/what-does-echo-see](what-does-echo-see) · [team repo](https://github.com/nikolai-laba/what-does-echo-see) |
| Party in a Box | Team PARTY | [projects/party-in-a-box](party-in-a-box) |
| Oak Park Safe Routes | Team Shadowbat | [projects/oak-park-safe-routes](oak-park-safe-routes) · [team repo](https://github.com/Shawdowbat/OakParkCrimeWebApp) |
| Oak Park Architecture Walks | | [Claude artifact](https://claude.ai/artifact/Njn9DEGuYTsabA76HMtQUT) · [project notes](oak-park-architecture-walks) |

The archived code includes each team's latest work at the end of the day, including changes that were not yet shared, without installed dependencies or build output.

Oak Park Architecture Walks is linked as a hosted Claude artifact. Its source code is not available in this archive.

## Published site

The [published site](https://oak-park-cisc.github.io/Oak_Park_Day_in_our_Data/) is served from the `gh-pages` branch: an index plus a static build of each app.

- Vite apps were built with `vite build --base ./`; root-absolute `/data/` paths were made relative in the published copies only.
- Oak Park Transit was built with its team's `VITE_BUS_PROXY_URL`. The team's proxy only answers its own site, so the published copy shows a sample of vehicle positions.
- Party in a Box needs its API server and database, so the site shows screenshots of the running app (`party-in-a-box/showcase`).
- Oak Park Safe Routes was a Flask app. `oak-park-safe-routes` is a static port that runs the same filtering, scoring and route planning in the browser from the CSV and GeoJSON files.
