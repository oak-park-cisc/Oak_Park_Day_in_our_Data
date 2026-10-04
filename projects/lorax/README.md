# Oak Park street tree diversity

**Question:** Where is Oak Park's public tree population diverse and resilient, and where does it depend too heavily on a few species?

A map, ranked list and search tool for tree diversity on each of Oak Park's 814 blocks, built from the Village tree inventory.

The app opens on the **Area** tab with a short welcome popup (shown on every load) that asks visitors to draw a rectangle on the map to get started; the ? button in the header shows it again.

- **Map:** color blocks from red (needs attention) to green by diversity (top genus share, top species share, species diversity) or by size and shade (median trunk diameter, height, crown spread, canopy per foot of street). Thicker lines also mark blocks needing attention, so the map reads without relying on red/green alone.
- **Majority flag:** a toggle (flag button in the header) that limits every view to blocks where one species — or optionally one genus — makes up 55% or more of the trees. Threshold and minimum tree count are adjustable.
- **Ranked list:** blocks that need attention appear first. You can search by street.
- **Block detail:** shows the most common species against the 10% guideline, the genus and species breakdown, size medians and the 20% one-genus guideline.
- **Filters:** narrow blocks by top-genus share, top-species share, species diversity, most common genus, D97 school zone and tree count. The map grays out the rest, and "Download these" saves the matching blocks as CSV.
- **Near me:** type an Oak Park address, use your location or tap the map to see every public tree within 150–600 ft, drawn at its recorded crown spread.
- **Zones:** compares the 8 D97 elementary attendance zones by the share of blocks dominated by one genus, diversity, trunk size and canopy.
- **Satellite:** NASA MODIS (MOD44B) tree cover, public and private, for 231 cells of about 230 m across the village, 2000–2025, with a per-cell comparison to the public tree inventory.
- **Area:** draw a rectangle (tap two corners) or use the current map view to get everything for that area: trees, species and genus mix with 10-20-30 checks, size and shade medians, trunk-size classes, blocks and zones inside, satellite tree cover, and a CSV of the trees.
- **Canopy estimate:** from recorded crown spread — ground under crowns with overlaps counted once (and the simple sum), for any drawn area, each block and each zone. Public-tree crowns cover about 10.7% of the village.
- **Download:** the full block table (`public/data/blocks.csv`) or zone table (`public/data/zones.csv`).

## Run

```sh
npm install
npm run dev     # http://127.0.0.1:5173
npm run data    # rebuild the derived files in public/data from the source files
npm run fetch:modis  # re-download the MODIS tree-cover subset (public ORNL DAAC service)
npm run check   # Biome lint + format check
npm run build
```

## Data

Sources, retrieval dates and calculation notes are in [public/data/SOURCES.md](public/data/SOURCES.md).

**Limits:** The inventory has no tree age, condition or planting-year data. The cached census file only has village-wide totals, so the app doesn't compare census indicators across areas. Blocks with fewer than 10 trees aren't flagged. Canopy figures are estimates from crown spread (recorded in 10 ft classes, crowns treated as circles) and cover public trees only. MODIS cells are 250 m, so each spans several blocks; yearly MODIS values are noisy, and the app uses Collection 6.1 because version 6.0 needs a NASA Earthdata login.

`data/sample.csv` is fictional starter data and is not used by the app.
