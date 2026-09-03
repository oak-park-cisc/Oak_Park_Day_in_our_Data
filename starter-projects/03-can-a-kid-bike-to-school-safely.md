# Can a kid bike to school safely?

**The question:** How well do Oak Park's bike facilities connect kids' homes to their schools — and what do crash records say about the gaps?

**Why it matters:** Hundreds of Oak Park kids bike or walk to school daily. Whether the network actually serves those trips is checkable with public data.

## The data

- Village of Oak Park GIS layers (bikeways and more, ArcGIS query endpoints used by existing local projects):
  `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13/query` (and layer 159)
- Village traffic crash data — refreshed nightly on the Village open data portal (exact dataset link listed in `data/README.md`; cached extract: `data/crashes-oak-park.csv`)
- School locations: `data/schools-oak-park.csv` (D97 + D200 + private, cached in repo)

## First win (15 minutes)

Print-map exercise: mark the schools, trace the existing bike routes, circle where a reasonable school route leaves the network.

## The build (by 2:15)

A map (Leaflet, Google MyMaps, or even annotated images) showing bike facilities, schools, and the gaps between them. Overlay bike/pedestrian-involved crashes to show whether the gaps and the crashes coincide.

## Stretch

Score each school 1–10 on network connection; rank the intersections nearest schools by crash count; propose the single highest-value missing link.

## No-code roles

- Local knowledge is the core skill here: parents and students know which crossings are actually scary
- Google MyMaps needs no code at all and produces a shareable demo
- Storyteller: "the route from X to Julian breaks down at Y" beats any heat map

## Claude tips

Ask Claude to convert a GeoJSON layer into a simple Leaflet page, or paste crash rows and ask "which intersections within 2 blocks of a school appear most often?"
