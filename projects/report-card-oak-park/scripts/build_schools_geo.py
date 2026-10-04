"""Fetch Oak Park school geography from the Village of Oak Park GIS (ArcGIS).

Downloads three layers listed in data/open-data-catalog.md, joins them to the
school ids in public/data/schools.json, and writes public/data/schools-geo.json.

- Elementary_Attendance_Zones: official D97 elementary attendance-zone polygons.
  D97 middle schools and OPRF serve the whole village and have no zone.
- Elementary_and_Middle_Schools: school building footprint polygons (D97 only).
- Municipal_Boundary: the Oak Park village outline used to frame the map.

The OPRF high school is not in the Village footprints layer, so its marker
comes from an OpenStreetMap/Nominatim geocode of 201 N Scoville Ave.
"""

import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "schools-geo.json"
UA = "oak-park-schools-dashboard/0.1 (civic data project; Day in Our Data)"

SERVICES = {
	"zones": "https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0/query?where=1%3D1&outFields=Name,PopupInfo&outSR=4326&f=geojson",
	"buildings": "https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_and_Middle_Schools/FeatureServer/0/query?where=1%3D1&outFields=NAME,TYPE&outSR=4326&f=geojson",
	"boundary": "https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?where=1%3D1&outFields=COMMUNITYN&outSR=4326&f=geojson",
}

# Zone layer names -> names used in public/data/schools.json
ZONE_TO_SCHOOL = {
	"Mann Elementary": "Horace Mann Elem School",
	"Hatch Elementary": "William Hatch Elem School",
	"Whittier Elementary": "Whittier Elem School",
	"Holmes Elementary": "Oliver W Holmes Elem School",
	"Beye Elementary": "William Beye Elem School",
	"Lincoln Elementary": "Abraham Lincoln Elem School",
	"Irving": "Irving Elem School",
	"Longfellow": "Longfellow Elem School",
}

# Footprint layer names -> names used in public/data/schools.json
FOOTPRINT_TO_SCHOOL = {
	"Abraham Lincoln School": "Abraham Lincoln Elem School",
	"Gwendolyn Brooks Middle School": "Gwendolyn Brooks Middle School",
	"Henry Wadsworth Longfellow School": "Longfellow Elem School",
	"Horace Mann School": "Horace Mann Elem School",
	"John Greenleaf Whittier School": "Whittier Elem School",
	"Oliver Wendell Holmes School": "Oliver W Holmes Elem School",
	"Percy Julian Middle School": "Percy Julian Middle School",
	"Washington Irving School": "Irving Elem School",
	"William Beye Elementary School": "William Beye Elem School",
	"William Hatch School": "William Hatch Elem School",
}


def fetch(url: str) -> dict:
	req = urllib.request.Request(url, headers={"User-Agent": UA})
	with urllib.request.urlopen(req, timeout=60) as res:
		return json.load(res)


def round_coords(coords):
	if isinstance(coords[0], (int, float)):
		return [round(coords[0], 6), round(coords[1], 6)]
	return [round_coords(c) for c in coords]


def polygon_of(feature):
	geom = feature["geometry"]
	if geom["type"] == "Polygon":
		return round_coords(geom["coordinates"])
	if geom["type"] == "MultiPolygon":
		return round_coords(geom["coordinates"][0])
	raise ValueError(f"unexpected geometry {geom['type']}")


def nominatim(query: str) -> tuple[float, float]:
	url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
		{"q": query, "format": "json", "limit": 1}
	)
	req = urllib.request.Request(url, headers={"User-Agent": UA})
	rows = json.load(urllib.request.urlopen(req, timeout=60))
	if not rows:
		raise ValueError(f"nominatim found nothing for {query!r}")
	return float(rows[0]["lat"]), float(rows[0]["lon"])


def main():
	schools = json.loads((ROOT / "public" / "data" / "schools.json").read_text())
	id_of = {row["name"]: row["id"] for row in schools["rows"]}
	if "Oak Park & River Forest High Sch" not in id_of:
		raise ValueError("schools.json is missing the OPRF row")

	feats = {k: fetch(url)["features"] for k, url in SERVICES.items()}
	time.sleep(1)
	oprf_lat, oprf_lon = nominatim("201 N Scoville Ave, Oak Park, IL")

	zones = []
	for f in feats["zones"]:
		name = f["properties"]["PopupInfo"]
		school = ZONE_TO_SCHOOL.get(name)
		if school is None:
			raise ValueError(f"unmapped attendance zone {name!r}")
		zones.append({"id": id_of[school], "polygon": polygon_of(f)})

	buildings = []
	for f in feats["buildings"]:
		name = f["properties"]["NAME"]
		school = FOOTPRINT_TO_SCHOOL.get(name)
		if school is None:
			raise ValueError(f"unmapped school footprint {name!r}")
		buildings.append({"id": id_of[school], "polygon": polygon_of(f)})

	boundary = feats["boundary"][0]
	if boundary["properties"]["COMMUNITYN"].strip().upper() != "OAK PARK":
		raise ValueError("municipal boundary is not Oak Park")

	out = {
		"boundary": polygon_of(boundary),
		"zones": zones,
		"buildings": buildings,
		"oprf": {"id": id_of["Oak Park & River Forest High Sch"], "lat": oprf_lat, "lon": oprf_lon},
	}
	OUT.write_text(json.dumps(out, separators=(",", ":")))
	print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
	print(f"zones={len(zones)} buildings={len(buildings)} oprf=({oprf_lat}, {oprf_lon})")


if __name__ == "__main__":
	main()