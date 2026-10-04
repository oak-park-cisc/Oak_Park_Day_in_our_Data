# Oak Park's Oldest Oaks

An interactive map of public oaks in Oak Park, Illinois, that may have been growing before the Kettlestrings family arrived in 1833.

The map shows **61 native oaks** on Village parkways and in Park District parks whose estimated age range reaches 200 years.
- Markers are colored by confidence: **Likely**, **Possible** or **Long shot**.
- A gold ring marks the **7 bur oaks likely present at settlement (1833)**.

## Features

- **Map:** zoomable map with an OpenStreetMap basemap and a confidence legend.
- **Popup card:** estimated age range, species, trunk circumference, canopy width and a short narrative.
- **More (details panel):**
  - approximate address and historic district
  - how the age range was estimated
  - confidence and the reasons for it
  - size and rank
  - 1830s land cover and nearest historic house
  - tree ID and data sources
- **Tree list:** all trees grouped by confidence. Tap one to jump to it.
- **About panel:** method, limits and sources.
- **Layout:** works on phones and desktop, in light and dark themes. A selected tree and open panel are kept in the URL, so links can be shared.

## How age is estimated

Age comes from trunk diameter (DBH), not tree rings, so every age is a range:

- **Low end:** Morton Arboretum table of Chicago-area street trees (Dwyer 2009, 2010). Values beyond the table are extrapolated.
- **High end:** Morton Arboretum growth factors for Chicago-area old-growth forest.
- **Inclusion:** a tree is shown if the high end reaches 200 years.

**Confidence** combines three things: species group (white oaks live longer), how far the range reaches past 200, and whether the 1830s land survey mapped the spot as timber.

**Likely present at settlement** means Likely confidence plus an age-range midpoint of at least 193 years.

These are estimates. Different published methods disagree by about 2×. Only tree-ring cores or historical records can confirm a tree's age. See [docs/decision-log.md](docs/decision-log.md) for the methods compared.

## Data sources

| Data | Source |
|---|---|
| Parkway trees | [Village of Oak Park tree inventory](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0), via [Oak Park Day in our Data](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data) |
| Park trees | [Park District of Oak Park tree inventory](https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/PDOP_Trees_8_30_22_Public/FeatureServer/0) (2022) |
| Age, low end | [Morton Arboretum, Estimated Age of Urban Trees by Species and Diameter](http://content.govdelivery.com/attachments/INSTATE/2015/01/12/file_attachments/355000/TMAestimatetreeDBH_Age.pdf) |
| Age, high end | Morton Arboretum old-growth factors, as summarized by [Friends of Eloise Butler](https://friendsofeloisebutler.org/pages/photosubpages/photoinfopages/treeagecalculator.html) |
| 1830s land cover | [Illinois Landcover in the Early 1800s](https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s) (INHS / ISGS) |
| Addresses, houses, districts | Village street centerlines, Historic Building Dataset and historic districts (same repository) |
| Basemap | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |

Full details, filters and retrieval dates: [public/data/SOURCES.md](public/data/SOURCES.md).

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run check      # Biome lint and format check
```

## Rebuild the data

The app reads static files in `public/data/`. To regenerate them from the sources (Python 3.10+):

```sh
pip install pyshp pyproj shapely
python3 scripts/build_data.py         # writes public/data/oaks.json
python3 scripts/draft_narratives.py   # adds narratives for new trees; keeps existing text
```

Downloads are cached in `.cache/`, which is git-ignored.

To edit a narrative, change its `text` in `public/data/narratives.json`. [docs/narratives-review.md](docs/narratives-review.md) is a readable copy.

## Project layout

```
public/data/       oaks.json, narratives.json, SOURCES.md
scripts/           data build, narrative drafts, screenshot checks
src/               React app (map, popup card, details, list, about)
docs/              decision log, research notes, narrative review copy
```

## Limits

- Public trees only. Trees in private yards aren't included.
- Native oaks only. Pin oaks are excluded because in Oak Park they're almost always planted.
- Addresses are approximate.
- Narratives are generated from the data and haven't been individually reviewed.
- The "Kenilworth Witness Oak" link to a specific tree is unconfirmed.

## Background

- Research notes and other possible sources: [docs/research-notes.md](docs/research-notes.md)
- Design decisions, options considered and parked ideas: [docs/decision-log.md](docs/decision-log.md)

License: not yet chosen.
