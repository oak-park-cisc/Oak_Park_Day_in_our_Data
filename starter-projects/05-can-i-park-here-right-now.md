# Can I park here right now?

**Civic question:** Can Oak Park parking rules be made easier to understand at a specific place and time?

**Minimum viable demo:**

- Let a user select an address or location, day, and time.
- Display the relevant parking restrictions in plain language.
- Show available information about permits, payment, enforcement hours, duration, accessible spaces, overnight rules, and EV charging.

**Stretch goals:**

- Add a map of nearby municipal lots, garages, accessible spaces, and EV chargers.
- Generate a shareable or printable parking summary.
- Test the wording and interface for accessibility and multilingual use.

**Data:**

- Parking-restriction and facility layers in [Modes of Transportation](https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570): VOP MapServer layer 42, `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/42/query?where=1%3D1&outFields=*&outSR=4326&f=geojson` (filter `production_notes` = Daytime Parking Restrictions for curb rules, `PARKINGAREATYPE IN ('LOT','GARAGE')` for lots), layers 9 and 10 on the same MapServer for the overnight ban, layer 4 (EV charging), layer 36 (Village-only chargers), layer 3 (car share)
- Village web maps: [Daytime Parking Restrictions Map](https://www.arcgis.com/home/item.html?id=612c713946094edebcdbefb9efc298c6), [Overnight Parking Restrictions Map](https://www.arcgis.com/home/item.html?id=8fae1fbfc3434fb5b30a6e2272e0f64c), [No Overnight Passes Map](https://www.arcgis.com/home/item.html?id=5347005a5f2a4f21a8029a65be91e81d), the printed [Overnight Parking Map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/documents/f9735ab3100c45de87045b2f95a4ea11), the GIS Consortium's [overnight pass web map](https://www.gisconsortium.org/WebApps/CommunityPortalWebMaps/VOP/OvernightParkingBan/index.html), and the [daytime restrictions PDF map](https://www.oak-park.us/files/assets/oakpark/v/4/parking/parking-maps/daytime-parking-restrictions-map.pdf)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- The rules themselves, from the Village's parking pages (they block scripts, so read them in a browser): [Parking Guidelines & Restrictions](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Guidelines-Restrictions), [Parking Passes](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Passes), [Parking Permits](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Permits), [Permit Maps & Zone Guidelines](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Permit-Maps-Zone-Guidelines) (a PDF per zone and per lot), and [Snow Emergency Parking](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Seasonal-Parking/Snow-Emergency-Parking)
- Cached in this repo: `data/parking-restrictions-oak-park.geojson` (1,532 polygons tagged `restriction_group`: 1,016 `daytime_on_street` segments with the sign wording in `location_description`, 390 `overnight_permit_street` segments, 25 `permit_zone` areas, 97 lots and 4 garages)
- Cached in this repo: `data/parking-overnight-ban-oak-park.geojson` (431 features where an overnight pass is not valid, `ban_type` = on_street or lot)
- Cached in this repo: `data/parking-facilities-oak-park.csv` (124 rows, one per garage, lot, EV charger, or car share site, with `permit_types`, `payment_device`, and centroid coordinates)
- Cached in this repo: `data/streets-oak-park.geojson` (Village centerlines with address ranges on each side, for the address lookup)

**Potential users:** Residents, visitors, Transportation Commission, Disability Access Commission

**Difficulty:** Intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Sign surveyors who photograph and transcribe every parking sign on three blocks and compare them with `location_description`, plain-language writers who turn the 128 sign strings and six categories into sentences a visitor understands, and someone who has gotten a ticket to test whether the prototype would have warned them.

**Limits:** `enforcement_times` is blank on nearly every daytime segment, so the hours are only in the sign text; 188 of the overnight-ban street segments have every rule field blank, `accessible_space_count` is empty everywhere, and the Village does not publish meter hours and rates, accessible-space locations, or street cleaning schedules as data, and 1,036 of the 2,486 addressed blocks have no restriction segment near them, so say "no daytime restriction recorded; check the sign," not "no restrictions." This should be presented as an informational prototype, not an authoritative legal determination.
