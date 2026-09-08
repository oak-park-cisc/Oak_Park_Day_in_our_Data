# How resilient is our urban forest?

**Civic question:** Where is Oak Park's public tree population diverse and resilient, and where is it overly dependent on a small number of species?

**Minimum viable demo:**

- Calculate tree-species diversity by block, street, or grid area.
- Identify places where a single species represents a large share of recorded trees.
- Use diameter, height, and spread as simple size and shade indicators.

**Stretch goals:**

- Create a resident-facing "trees near me" explorer.
- Estimate approximate canopy area using recorded tree spread.
- Compare tree distribution with recreation areas or demographic indicators, and suggest candidate areas for further field assessment or planting analysis.

**Data:**

- [Oak Park Tree Inventory](https://www.arcgis.com/home/item.html?id=792e798104b140c3b8063e86dc09d991): feature service `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson` (2,000 per page; add `resultOffset`), or the [CSV download](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/csv?layers=0)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b), feature service `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer/0`
- [Municipal Boundary](https://www.arcgis.com/home/item.html?id=6c1807a7ef5d4d77a9fbb1801d9d36d1)
- Cached in this repo: [trees-oak-park.csv](../data/trees-oak-park.csv) (every public tree with common and Latin name, DBH, height, spread, `latitude`, `longitude`, a `genus` column, and a `block` column snapped from the nearest centerline; 18,837 rows)
- Cached in this repo: [streets-oak-park.geojson](../data/streets-oak-park.geojson) (centerlines with address ranges, for blocks and base maps)
- Cached in this repo: [d97-attendance-zones.geojson](../data/d97-attendance-zones.geojson) and [acs-oak-park-timeseries.csv](../data/acs-oak-park-timeseries.csv) (optional overlays: D97 attendance zones and ACS block-group indicators)

**Potential users:** Environment & Energy Commission, Public Works, residents

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Walk one of the least diverse blocks and photograph the parkway, translate genera into what residents recognize and write the two-sentence "why one genus is a risk" explainer, or read the Village forestry pages for the current planting list.

**Limits:** The layer has no condition, age, or planting-year field, so do not claim tree health or age from it; DBH is the only size proxy. Villagewide the top species is 8.8 percent and the top genus 20.5 percent, right at the 10-20-30 line, but on 164 blocks a single genus is 30 percent or more of the trees.
