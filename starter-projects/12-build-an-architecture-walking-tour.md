# Build an architecture walking tour

**Civic question:** How can Oak Park's architectural history be made easier for residents and visitors to explore?

**Minimum viable demo:**

- Let users search or filter historic resources by architect, architectural style, construction period, designation, or location.
- Display images, historical summaries, and available source material.
- Generate a small walking tour near a selected starting point, such as Dole Branch Library.

**Stretch goals:**

- Offer themed tours such as Prairie School, Victorian-era buildings, women architects, or neighborhood history.
- Create an architecture quiz or scavenger hunt for students and families.
- Compare resources inside and outside designated historic districts, or match `address` to `prop_address` in the assessor file to find pre-1910 parcels nobody has surveyed.

**Data:**

- [Historic Building Dataset](https://www.arcgis.com/home/item.html?id=5a02234ddbed497a809810430a61853a): feature service `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0`, or the [Hub CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/csv?layers=0)
- [Historic Districts](https://www.arcgis.com/home/item.html?id=d3ff666dfb764e8183879667acce810e), VOP MapServer layer 13 `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13`
- [Historic Survey Areas](https://www.arcgis.com/home/item.html?id=315557a64ac84d45b71e55d94fd583ac), layer 155 on the same MapServer
- Cached in this repo: [historic-buildings-oak-park.csv](../data/historic-buildings-oak-park.csv) (one row per surveyed building with `address`, `architect`, `style_primary`, `construction_year`, `construction_decade`, `resource_rating`, designation flags, `historical_summary`, `image_url`, `form_url`, `latitude`, `longitude`, and `historic_district`; 4,958 rows)
- Cached in this repo: [historic-districts-oak-park.geojson](../data/historic-districts-oak-park.geojson) (the three historic district polygons plus the nine survey areas, tagged `layer` = district or survey_area)
- Cached in this repo: [assessed-values-oak-park.csv](../data/assessed-values-oak-park.csv) (`prop_address` and the Assessor's `year_built` for every parcel, for the stretch)

**Potential users:** Historic Preservation Commission, schools, residents, visitors

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** A curator who reads `historical_summary` for each stop and writes the "look for" line and a 40-word blurb, a route tester who walks the draft loop with the printed list and times it, and a designer for the printable tour card and a QR code to the map.

**Limits:** `architect` is blank for two thirds of rows and `historical_summary` is filled on 2,114 of them; one `construction_year` of 917 is a typo for 1917. About 4,380 of the 4,958 addresses match the assessor file, and the two sources disagree by more than ten years on 419 of them; the historic file is the researched one.
