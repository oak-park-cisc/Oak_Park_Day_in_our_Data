# Oak Park Safe Routes (static)

A static port of Team Shadowbat's [Flask app](https://github.com/Shawdowbat/OakParkCrimeWebApp). `static/js/safe-routes-core.js` answers the app's former API requests in the browser from `data/crime-incidents-oak-park.csv` and `data/street_segments.geojson`; address search uses OpenStreetMap Nominatim at most once a second.

Serve the folder with any static file server, for example `python3 -m http.server`.

## Equivalence check

`tests/requests.py` runs a matrix of filter, summary, incident and route requests through the original Flask app and writes `requests.json` and `python-responses.json`. `tests/compare.mjs` sends the same requests to the static port and compares the answers. Run `requests.py` with the original app's virtual environment from a checkout of the original app beside this folder, at `../oak-park-crime`, then `node compare.mjs`.
