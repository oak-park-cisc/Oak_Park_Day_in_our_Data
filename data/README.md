# Oak Park Open Data Catalog

This directory contains a repository-friendly version of the **Oak Park Open Data Catalog** workbook shared for the Day in Our Data hackathon on August 21, 2026.

The source catalog points to the [Oak Park Open Data Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/search). It is a snapshot rather than a live mirror, so attendees should verify important links and metadata against the portal.

## Files

- [`open-data-catalog.csv`](open-data-catalog.csv) — the complete catalog: 38 entries with descriptions, formats, dates, portal pages, service endpoints, and direct downloads where available.
- [`open-data-catalog-by-category.csv`](open-data-catalog-by-category.csv) — a curated category view: 43 rows organized for easier browsing. Category names are repeated on every row to support filtering and analysis.
- [`../project-ideas.md`](../project-ideas.md) — starter civic-hackathon challenges that use many of these datasets.

## Catalog summary

| Dataset type | Count |
| --- | ---: |
| Feature Service | 23 |
| Web Map / Document | 8 |
| Tabular (CSV available) | 7 |

## Column guide

| Column | Meaning |
| --- | --- |
| `dataset_number` | Stable row number from the source workbook. |
| `dataset_title` | Dataset or application title shown in the portal. |
| `description` | Portal description as captured in the source workbook. Placeholder or missing descriptions are preserved. |
| `dataset_type` | High-level classification used by the catalog. |
| `available_formats` | Formats or access methods advertised for the item. |
| `keywords_tags` | Portal keywords and tags. |
| `theme` | Theme value supplied by the catalog, when available. |
| `last_modified` | Last-modified date in ISO `YYYY-MM-DD` format. |
| `date_published` | Publication date in ISO `YYYY-MM-DD` format. |
| `portal_link` | Human-facing portal page. |
| `api_rest_link` | ArcGIS REST endpoint or linked application endpoint. |
| `geojson_link` | Direct GeoJSON download, when available. |
| `csv_download` | Direct CSV download, when available. |
| `shapefile_download` | Direct shapefile download, when available. |
| `kml_download` | Direct KML download, when available. |

## Tips for participants

1. CSV downloads are usually the easiest starting point for Python/Pandas, R, spreadsheets, and many visualization tools.
2. GeoJSON links work well with Leaflet, Mapbox, QGIS, and Python geospatial libraries.
3. ArcGIS REST links provide live metadata and support programmatic queries, filters, spatial searches, and pagination.
4. Shapefiles are useful for traditional GIS analysis in ArcGIS, QGIS, or Python.
5. Use the portal link to preview an item and review its current metadata before building against it.

Common ArcGIS REST patterns:

```text
?f=json
/query?where=1=1&outFields=*&f=geojson
/query?where=FIELD_NAME=VALUE&f=json
&resultRecordCount=10
```

## Conversion notes

- Column names were converted to lowercase `snake_case` for easier programmatic use.
- Embedded line breaks were normalized to spaces so each CSV record occupies one physical line.
- Empty cells, source placeholders such as `{{description}}`, duplicate portal entries, and source titles are preserved rather than silently corrected.
- The original Excel workbook is not included because CSV and Markdown produce clearer Git diffs and work without proprietary spreadsheet software.
