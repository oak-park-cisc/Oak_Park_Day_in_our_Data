# i-Tree Eco import file

`oak-park-trees-itree-eco.xlsx` holds Oak Park's public trees formatted for an i-Tree Eco v6 Complete Inventory project
(Windows desktop software, free account: https://www.itreetools.org/tools/i-tree-eco).

- **Trees**: 18,821 trees to import (Tree ID, scientific species name, DBH, height, crown width, latitude/longitude, public, zone).
  Gray columns are reference only; skip them in the import wizard.
- **Species list**: each species name, its count, and how it was derived from the inventory's Latin name.
- **Not included**: 16 records left out (stumps, unknown species, missing trunk size, one likely 111" data error).
- **Read me**: step-by-step import instructions.

Rebuild with `python3 scripts/export_itree.py` (needs `pip install openpyxl`).
Format follows the [Eco Guide to Importing an Existing Inventory](https://www.itreetools.org/resources/manuals/Ecov6_ManualsGuides/Ecov6Guide_InventoryImporter.pdf).
