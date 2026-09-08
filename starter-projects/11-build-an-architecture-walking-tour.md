# Build an architecture walking tour

**The question:** Oak Park has 4,958 surveyed historic buildings on file, with architect, style, date, photo, and a survey form for nearly every one. Can we turn that list into a walking tour a visitor or a fourth-grade class could actually follow, by architect, by style, or by street?

**Builds on:** project idea 5, [Oak Park Architecture Explorer and Walking Tour](../project-ideas.md#5-oak-park-architecture-explorer-and-walking-tour).

**Why it matters:** The tours people can buy stop at Frank Lloyd Wright's 25 buildings. The Village's dataset has 225 by Frank O. DeMoney, 113 each by E. E. Roberts and Ernest Braucher, 756 Queen Annes, and a documented 1853 house, and almost nobody outside the Historic Preservation Commission has seen it as anything but a map layer.

## The data

- Buildings: `data/historic-buildings-oak-park.csv`, 4,958 rows, one per surveyed building point, with `address`, `architect`, `builder`, `style_primary`, `style_secondary`, `form`, `construction_year` (with a certainty flag and source), `construction_decade`, `resource_rating` (Contributing or Non-Contributing), local and National Register designation flags, `historical_summary` (2,114 rows have one), `image_url` (a photo of nearly every building), `form_url` (the survey PDF), `latitude`, `longitude`, and `historic_district`.
  Live: the Village's Historic Building Dataset feature service `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0`, or the same thing as a Hub CSV `https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/csv?layers=0`.
- Districts: `data/historic-districts-oak-park.geojson`, the three historic district polygons (Frank Lloyd Wright-Prairie School, local and National Register; Ridgeland-Oak Park; Gunderson) plus the nine historic survey areas, each tagged `layer` = district or survey_area. Live: VOP MapServer layer 13 `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13` and layer 155 for the survey areas.
- For the stretch: `data/assessed-values-oak-park.csv` has `prop_address` and the Assessor's `year_built` for every parcel.

## First win (15 minutes)

Pivot the CSV three ways: count by `architect` (blank for two thirds of rows, then DeMoney, Roberts, Braucher), by `style_primary` (Prairie School 835, Queen Anne 756, Craftsman 606), and by `construction_decade` (the 1910s peak at 1,537). Then sort by `construction_year`: 532 Fair Oaks Ave, 1853, documented. Skip the row that says 917; it is a typo for 1917.

## The build (by 2:15)

Pick one theme: one architect (E. E. Roberts, 113 buildings), one style (Queen Anne), or one street (S Elmwood Ave has 209 rows). Filter to 8 to 12 stops within about a mile of each other, order them into a loop, and produce two things: a map (Leaflet or Google MyMaps) whose popups show the `image_url` photo, and a printable one-page list with address, year, architect, style, and a one-line "look for" pulled from `historical_summary`. Start the loop somewhere people already are: the Main Library at 834 Lake St, the Oak Park Green Line station, or Dole Branch.

## Stretch

- Undesignated twins: match `address` to `prop_address` in the assessor file (about 4,380 of the 4,958 line up), then flip the join. Assessor parcels with `year_built` before 1910 that are not in the historic dataset are the buildings nobody has surveyed. The two sources disagree by more than ten years on 419 matched buildings; the historic file is the researched one.
- Inside versus outside: 1,162 rows fall in no district. Which streets outside the three districts have the densest run of Contributing buildings?
- A photo quiz or scavenger hunt: show the picture, guess the style or the decade.

## No-code roles

- Curator: read the `historical_summary` for each stop and write the "look for" line and a 40-word blurb.
- Route tester: walk the draft loop with the printed list and time it; the Wright district is a short walk from most of the Village.
- Designer: the printable tour card, and a QR code to the map.

## Claude tips

Paste the filtered rows and ask: "order these 10 addresses into a walking loop starting at 834 Lake St and estimate the distance," then check the geometry against a map. Ask for a Leaflet page from the CSV whose popups show the `image_url` photo and the year. Ask it to write a plain-language 40-word blurb per building from `historical_summary`, `style_primary`, and `architect`.
