#!/usr/bin/env python3
"""
Build data/oak-park-levies.csv: one row per Oak Park taxing agency per tax
year (2006 to the latest year the Clerk has published), with the agency's
equalized assessed value (EAV), total levy, final tax rate and tax extension
as printed on the Cook County Clerk's Agency Tax Rate Report.

Source: Cook County Clerk, Tax Extension and Rates, Agency Tax Rate Reports
    https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates
    Report metadata (POST JSON): https://www.cookcountyclerkil.gov/api-tax/public/getreportdata
    Report PDF      (POST JSON): https://www.cookcountyclerkil.gov/api-tax/public/viewreport
    Both endpoints are POST-only (GET returns 405). The same calls back the
    "Tax Agency Reports" search form on the Clerk's website.

Usage:
    python3 data/scripts/fetch_oak_park_levies.py [--years 2006-2026] [--out data/oak-park-levies.csv]
                                                  [--cache DIR]

Requires only the Python 3 standard library: the Clerk publishes these reports
as PDFs, and this script includes a small PDF text extractor (FlateDecode
streams, TrueType and CID fonts with ToUnicode maps) so no PDF library is
needed. Downloaded PDFs are cached in --cache (default: a folder under the
system temp directory) so re-runs are fast.

Agencies (Cook County Clerk agency IDs):
    020180000  TOWN OAK PARK                     Oak Park Township
    020180002  GENERAL ASSISTANCE OAK PARK       Township General Assistance fund
    020180004  OAK PARK MENTAL HEALTH DISTRICT   Township Mental Health Board (708 Board)
    030920000  VILLAGE OF OAK PARK               Village corporate, pensions, bonds
    030920001  VILLAGE OF OAK PARK LIBRARY FUND  Oak Park Public Library
    040580000  SCHOOL DISTRICT 97                Oak Park Elementary School District 97
    042020000  CONSOLIDATED HIGH SCHOOL 200      Oak Park and River Forest High School District 200
    050760000  OAK PARK PARK DISTRICT            Park District of Oak Park

Report formats:
  * Tax years 2006-2023: mainframe-style report (CLRTM539-A). One PDF per
    agency ID, including separate PDFs for the Library fund and the two
    Township sub-funds. Values are read from the "AGENCY OVERALL EAV",
    "AGENCY GRAND TOTAL" and "TAX EXTENSION GRAND TOTAL" lines.
  * Tax years 2024 onward: redesigned report. The Library fund is a section of
    the Village PDF and General Assistance / Mental Health are sections of the
    Township PDF, so those agencies are read from the "<FUND> FUNDS TOTALS"
    lines of the parent PDF; other agencies from "AGENCY GRAND TOTALS".

High School District 200 also serves River Forest, so its levy is not all paid
by Oak Park. The oak_park_eav_share column is Oak Park's EAV (the Village's
Cook County EAV) divided by District 200's total EAV for that year, and
oak_park_extension = extension * oak_park_eav_share. For every other agency the
share is 1 and oak_park_extension equals extension.
"""
import argparse
import csv
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zlib

BASE = "https://www.cookcountyclerkil.gov/api-tax/public"
REPORT_TYPE_AGENCY_RATE = 1
FIRST_YEAR = 2006

AGENCIES = {
    "020180000": ("Oak Park Township", "Township"),
    "020180002": ("Oak Park Township General Assistance", "Township"),
    "020180004": ("Oak Park Township Mental Health Board", "Township"),
    "030920000": ("Village of Oak Park", "Municipality"),
    "030920001": ("Oak Park Public Library", "Library"),
    "040580000": ("Oak Park Elementary School District 97", "Grade School"),
    "042020000": ("Oak Park and River Forest High School District 200", "High School"),
    "050760000": ("Park District of Oak Park", "Parks"),
}
D200 = "042020000"
VILLAGE = "030920000"

# 2024+ consolidated PDFs: fund-section label -> agency id read from that section.
FUND_SECTIONS = {
    "030920000": {"CORPORATE": "030920000", "LIBRARY FUND": "030920001"},
    "020180000": {"CORPORATE": "020180000", "GENERAL ASSISTANCE": "020180002", "MENTAL HEALTH": "020180004"},
}

OUT_COLUMNS = [
    "tax_year", "agency_id", "agency_code", "agency_name", "agency_label", "agency_type",
    "eav", "total_levy", "final_rate", "extension",
    "oak_park_eav_share", "oak_park_extension", "report_format", "source_pdf", "note",
]


# --------------------------------------------------------------------------
# Cook County Clerk API
# --------------------------------------------------------------------------

def post_json(path, payload, attempts=4):
    body = json.dumps(payload).encode("utf-8")
    delay = 3
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(BASE + path, data=body, headers={
            "Content-Type": "application/json", "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Oak Park Day in Our Data)",
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.headers.get("content-type", ""), resp.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            if attempt == attempts:
                raise
            print("  retry %d after %s" % (attempt, exc), file=sys.stderr)
            time.sleep(delay)
            delay *= 2


def list_reports(year):
    """Metadata for every Agency Tax Rate Report the Clerk has for our agencies in `year`."""
    payload = {"page": 1, "itemsPerPage": 50, "request": {
        "Year": str(year), "ReportTypeId": REPORT_TYPE_AGENCY_RATE, "AgencyTypeId": "0",
        "Agencies": sorted(AGENCIES), "AgencyName": ""}}
    _, body = post_json("/getreportdata", payload)
    data = json.loads(body)
    return data.get("data", [])


def download_pdf(report, all_agency_ids):
    payload = {"All": False, "AgencyType": report["agencyTypeId"], "ReportTypeId": report["reportTypeId"],
               "Year": str(report["year"]), "Agencies": all_agency_ids, "AgencyName": "", "Ignore": False,
               "TaxReports": [{"agencyId": report["agencyId"], "year": report["year"],
                               "reportTypeId": report["reportTypeId"]}]}
    ctype, body = post_json("/viewreport", payload)
    if not body.startswith(b"%PDF"):
        raise RuntimeError("viewreport did not return a PDF (content-type %s)" % ctype)
    return body


# --------------------------------------------------------------------------
# Minimal PDF text extraction (standard library only)
# --------------------------------------------------------------------------

class Name(str):
    """A PDF name object (/Foo)."""


class Ref(tuple):
    """An indirect object reference (num, gen)."""


_TOKEN = re.compile(
    rb"\s+|%[^\r\n]*"                       # whitespace, comments
    rb"|(<<|>>|\[|\]|\{|\})"                # delimiters
    rb"|/([^\s/\[\]<>(){}%]*)"              # name
    rb"|(\()"                               # literal string start
    rb"|<([0-9A-Fa-f\s]*)>"                 # hex string
    rb"|([+-]?(?:\d+\.?\d*|\.\d+))"         # number
    rb"|([^\s/\[\]<>(){}%]+)",              # keyword / operator
    re.S)

_ESCAPES = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f",
            b"(": b"(", b")": b")", b"\\": b"\\"}


def _read_literal_string(data, pos):
    """pos points just after '('. Returns (bytes, new_pos)."""
    depth, out, i = 1, bytearray(), pos
    while i < len(data):
        c = data[i:i + 1]
        if c == b"\\":
            nxt = data[i + 1:i + 2]
            if nxt in _ESCAPES:
                out += _ESCAPES[nxt]
                i += 2
            elif nxt.isdigit():
                m = re.match(rb"[0-7]{1,3}", data[i + 1:i + 4])
                out.append(int(m.group(0), 8) & 0xFF)
                i += 1 + len(m.group(0))
            elif nxt in (b"\n", b"\r"):
                i += 2
                if nxt == b"\r" and data[i:i + 1] == b"\n":
                    i += 1
            else:
                out += nxt
                i += 2
        elif c == b"(":
            depth += 1
            out += c
            i += 1
        elif c == b")":
            depth -= 1
            if depth == 0:
                return bytes(out), i + 1
            out += c
            i += 1
        else:
            out += c
            i += 1
    return bytes(out), i


def tokenize(data, pos=0, end=None):
    """Yield (kind, value) tokens. kinds: delim, name, string, number, keyword."""
    end = len(data) if end is None else end
    while pos < end:
        m = _TOKEN.match(data, pos)
        if not m:
            pos += 1
            continue
        pos = m.end()
        if m.group(1):
            yield "delim", m.group(1)
        elif m.group(2) is not None:
            yield "name", Name(m.group(2).decode("latin-1"))
        elif m.group(3):
            s, pos = _read_literal_string(data, pos)
            yield "string", s
        elif m.group(4) is not None:
            hexdigits = re.sub(rb"\s", b"", m.group(4))
            if len(hexdigits) % 2:
                hexdigits += b"0"
            yield "string", bytes.fromhex(hexdigits.decode("ascii"))
        elif m.group(5):
            txt = m.group(5)
            yield "number", (float(txt) if b"." in txt else int(txt))
        elif m.group(6):
            yield "keyword", m.group(6)


def parse_objects(tokens):
    """Turn a token stream into Python values; keywords are yielded as ('op', kw)."""
    stack = [[]]
    for kind, val in tokens:
        if kind == "delim":
            if val in (b"<<", b"["):
                stack.append([])
            elif val == b">>":
                items = stack.pop()
                d = {}
                for i in range(0, len(items) - 1, 2):
                    if isinstance(items[i], Name):
                        d[str(items[i])] = items[i + 1]
                stack[-1].append(d)
            elif val == b"]":
                items = stack.pop()
                stack[-1].append(items)
        elif kind == "keyword":
            if val == b"R" and len(stack[-1]) >= 2:
                gen = stack[-1].pop()
                num = stack[-1].pop()
                stack[-1].append(Ref((num, gen)))
            elif val == b"true":
                stack[-1].append(True)
            elif val == b"false":
                stack[-1].append(False)
            elif val == b"null":
                stack[-1].append(None)
            else:
                if len(stack) == 1:
                    operands = stack[0]
                    stack[0] = []
                    yield "op", (val, operands)
                # keywords inside a dict/array (should not happen) are ignored
        else:
            stack[-1].append(val)
    if stack[0]:
        yield "values", stack[0]


class PDFDocument:
    def __init__(self, data):
        self.data = data
        self.offsets = {}
        for m in re.finditer(rb"(?<![0-9])(\d+)\s+(\d+)\s+obj\b", data):
            self.offsets[int(m.group(1))] = m.end()
        self._cache = {}

    def resolve(self, obj):
        while isinstance(obj, Ref):
            obj = self.get(obj[0])
        return obj

    def get(self, num):
        if num in self._cache:
            return self._cache[num]
        self._cache[num] = None
        pos = self.offsets.get(num)
        if pos is None:
            return None
        # Parse the first complete object after "N G obj"
        value = None
        for kind, val in parse_objects(tokenize(self.data, pos, min(len(self.data), pos + 200000))):
            if kind == "op":
                kw, operands = val
                if operands:
                    value = operands[0]
                if kw == b"stream":
                    value = self._read_stream(value if isinstance(value, dict) else {}, pos)
                break
            elif kind == "values":
                value = val[0] if val else None
                break
        self._cache[num] = value
        return value

    def _read_stream(self, sdict, obj_pos):
        m = re.compile(rb"stream\r?\n").search(self.data, obj_pos)
        start = m.end()
        length = self.resolve(sdict.get("Length"))
        raw = None
        if isinstance(length, (int, float)):
            cand = self.data[start:start + int(length)]
            if re.match(rb"\s*endstream", self.data[start + int(length):start + int(length) + 20]):
                raw = cand
        if raw is None:
            endm = self.data.find(b"endstream", start)
            raw = self.data[start:endm].rstrip(b"\r\n")
        return Stream(sdict, raw, self)


class Stream:
    def __init__(self, sdict, raw, doc):
        self.dict = sdict
        self.raw = raw
        self.doc = doc

    def decoded(self):
        filters = self.doc.resolve(self.dict.get("Filter"))
        if filters is None:
            return self.raw
        if not isinstance(filters, list):
            filters = [filters]
        data = self.raw
        for f in filters:
            f = str(self.doc.resolve(f))
            if f in ("FlateDecode", "Fl"):
                try:
                    data = zlib.decompress(data)
                except zlib.error:
                    data = zlib.decompressobj().decompress(data)
            else:
                raise RuntimeError("Unsupported PDF stream filter: %s" % f)
        return data


def parse_tounicode(cmap_bytes):
    """ToUnicode CMap -> {code_int: str}."""
    mapping = {}
    text = cmap_bytes

    def hex_to_int(h):
        return int(h, 16)

    def hex_to_str(h):
        b = bytes.fromhex(h)
        try:
            return b.decode("utf-16-be")
        except UnicodeDecodeError:
            return b.decode("latin-1")

    for block in re.findall(rb"beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            mapping[hex_to_int(src)] = hex_to_str(dst.decode("ascii"))
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", text, re.S):
        for lo, hi, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])", block):
            lo_i, hi_i = hex_to_int(lo), hex_to_int(hi)
            if dst.startswith(b"["):
                items = re.findall(rb"<([0-9A-Fa-f]+)>", dst)
                for i, item in enumerate(items):
                    mapping[lo_i + i] = hex_to_str(item.decode("ascii"))
            else:
                base = hex_to_str(dst[1:-1].decode("ascii"))
                for code in range(lo_i, hi_i + 1):
                    mapping[code] = base[:-1] + chr(ord(base[-1]) + code - lo_i) if base else ""
    return mapping


class Font:
    def __init__(self, doc, fdict):
        fdict = doc.resolve(fdict) or {}
        self.two_byte = str(doc.resolve(fdict.get("Subtype"))) == "Type0"
        tu = doc.resolve(fdict.get("ToUnicode"))
        self.tounicode = parse_tounicode(tu.decoded()) if isinstance(tu, Stream) else None
        self.widths = {}
        self.default_width = 500.0
        if self.two_byte:
            desc = doc.resolve(fdict.get("DescendantFonts")) or []
            cid = doc.resolve(desc[0]) if desc else {}
            self.default_width = float(doc.resolve(cid.get("DW", 1000)))
            w = doc.resolve(cid.get("W")) or []
            i = 0
            while i < len(w):
                first = doc.resolve(w[i])
                nxt = doc.resolve(w[i + 1]) if i + 1 < len(w) else None
                if isinstance(nxt, list):
                    for j, width in enumerate(nxt):
                        self.widths[int(first) + j] = float(doc.resolve(width))
                    i += 2
                else:
                    last, width = nxt, doc.resolve(w[i + 2]) if i + 2 < len(w) else self.default_width
                    for code in range(int(first), int(last) + 1):
                        self.widths[code] = float(width)
                    i += 3
        else:
            first = doc.resolve(fdict.get("FirstChar"))
            widths = doc.resolve(fdict.get("Widths"))
            fd = doc.resolve(fdict.get("FontDescriptor")) or {}
            if "MissingWidth" in fd:
                self.default_width = float(doc.resolve(fd["MissingWidth"]))
            if isinstance(first, (int, float)) and isinstance(widths, list):
                for j, width in enumerate(widths):
                    self.widths[int(first) + j] = float(doc.resolve(width))

    def codes(self, s):
        if self.two_byte:
            return [int.from_bytes(s[i:i + 2], "big") for i in range(0, len(s) - 1, 2)]
        return list(s)

    def decode(self, code):
        if self.tounicode is not None:
            return self.tounicode.get(code, "")
        if self.two_byte:
            return chr(code)
        return bytes([code]).decode("cp1252", errors="replace")

    def width(self, code):
        return self.widths.get(code, self.default_width)


def mat_mul(m, n):
    a, b, c, d, e, f = m
    a2, b2, c2, d2, e2, f2 = n
    return (a * a2 + b * c2, a * b2 + b * d2, c * a2 + d * c2, c * b2 + d * d2,
            e * a2 + f * c2 + e2, e * b2 + f * d2 + f2)


def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def page_chunks(doc, page):
    """Run the page's content stream; return positioned text chunks."""
    resources = doc.resolve(page.get("Resources")) or {}
    fonts_dict = doc.resolve(resources.get("Font")) or {}
    fonts = {}
    contents = doc.resolve(page.get("Contents"))
    if isinstance(contents, list):
        data = b"\n".join(doc.resolve(c).decoded() for c in contents)
    elif isinstance(contents, Stream):
        data = contents.decoded()
    else:
        return []

    chunks = []
    ctm = (1, 0, 0, 1, 0, 0)
    stack = []
    tm = tlm = (1, 0, 0, 1, 0, 0)
    font, size, tc, tw, th, tl, ts = None, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0

    def show(s):
        nonlocal tm
        if font is None:
            return
        trm = mat_mul(mat_mul((size * th, 0, 0, size, 0, ts), tm), ctm)
        start = apply(trm, 0, 0)
        text = []
        space_w = max(0.25 * size, 1e-6)
        codes = font.codes(s)
        end = start
        for i, code in enumerate(codes):
            text.append(font.decode(code))
            tm = mat_mul((1, 0, 0, 1, font.width(code) / 1000.0 * size * th, 0), tm)
            if i == len(codes) - 1:
                # chunk ends after the last glyph, before any trailing spacing
                end = apply(mat_mul(mat_mul((size * th, 0, 0, size, 0, ts), tm), ctm), 0, 0)
            extra = tc + (tw if (code == 32 and not font.two_byte) else 0)
            tm = mat_mul((1, 0, 0, 1, extra * th, 0), tm)
            # Some producers position columns with large character spacing inside
            # one string ("38" printed 8 spaces apart); render that as whitespace.
            if i < len(codes) - 1 and extra > 0.5 * space_w and text[-1] != " ":
                text.append(" " * max(1, int(round(extra / space_w))))
        a, b = trm[0], trm[1]
        norm = (a * a + b * b) ** 0.5 or 1.0
        chunks.append({"start": start, "end": end, "text": "".join(text), "size": norm, "dir": (a / norm, b / norm)})

    for kind, (op, args) in parse_objects(tokenize(data)):
        try:
            if op == b"q":
                stack.append(ctm)
            elif op == b"Q":
                ctm = stack.pop() if stack else ctm
            elif op == b"cm":
                ctm = mat_mul(tuple(args[-6:]), ctm)
            elif op == b"BT":
                tm = tlm = (1, 0, 0, 1, 0, 0)
            elif op == b"Tf":
                fname = str(args[0])
                if fname not in fonts:
                    fonts[fname] = Font(doc, fonts_dict.get(fname))
                font, size = fonts[fname], float(args[1])
            elif op == b"Tc":
                tc = float(args[0])
            elif op == b"Tw":
                tw = float(args[0])
            elif op == b"Tz":
                th = float(args[0]) / 100.0
            elif op == b"TL":
                tl = float(args[0])
            elif op == b"Ts":
                ts = float(args[0])
            elif op == b"Td":
                tlm = mat_mul((1, 0, 0, 1, float(args[0]), float(args[1])), tlm)
                tm = tlm
            elif op == b"TD":
                tl = -float(args[1])
                tlm = mat_mul((1, 0, 0, 1, float(args[0]), float(args[1])), tlm)
                tm = tlm
            elif op == b"Tm":
                tm = tlm = tuple(float(v) for v in args[-6:])
            elif op == b"T*":
                tlm = mat_mul((1, 0, 0, 1, 0, -tl), tlm)
                tm = tlm
            elif op == b"Tj":
                show(args[-1])
            elif op == b"'":
                tlm = mat_mul((1, 0, 0, 1, 0, -tl), tlm)
                tm = tlm
                show(args[-1])
            elif op == b'"':
                tw, tc = float(args[0]), float(args[1])
                tlm = mat_mul((1, 0, 0, 1, 0, -tl), tlm)
                tm = tlm
                show(args[-1])
            elif op == b"TJ":
                for item in args[-1]:
                    if isinstance(item, bytes):
                        show(item)
                    elif isinstance(item, (int, float)) and font is not None:
                        tm = mat_mul((1, 0, 0, 1, -item / 1000.0 * size * th, 0), tm)
        except (IndexError, TypeError, ValueError):
            continue
    return chunks


def chunks_to_text(chunks):
    """Group positioned chunks into lines, reading in the text's own orientation."""
    if not chunks:
        return ""
    rows = []
    for c in chunks:
        dx, dy = c["dir"]
        down = (dy, -dx)
        rows.append((c["start"][0] * down[0] + c["start"][1] * down[1],
                     c["start"][0] * dx + c["start"][1] * dy,
                     c["end"][0] * dx + c["end"][1] * dy, c))
    rows.sort(key=lambda r: (r[0], r[1]))
    lines, current, current_key = [], [], None
    for key, a0, a1, c in rows:
        tol = max(2.0, 0.45 * c["size"])
        if current and abs(key - current_key) > tol:
            lines.append(current)
            current = []
        if not current:
            current_key = key
        current.append((a0, a1, c))
    if current:
        lines.append(current)

    out = []
    for line in lines:
        line.sort(key=lambda r: r[0])
        text, cursor = "", None
        for a0, a1, c in line:
            if cursor is not None:
                space_w = max(0.2 * c["size"], 1.0)
                gap = a0 - cursor
                if gap > 0.5 * space_w and not text.endswith(" ") and not c["text"].startswith(" "):
                    text += " " * max(1, int(round(gap / space_w)))
            text += c["text"]
            cursor = max(a1, a0)
        out.append(text.rstrip())
    return "\n".join(out)


def pdf_pages(doc):
    """Page dicts in document order (Kids traversal, falling back to object order)."""
    root = None
    for num in sorted(doc.offsets):
        obj = doc.get(num)
        if isinstance(obj, dict) and str(obj.get("Type")) == "Pages" and "Parent" not in obj:
            root = obj
            break
    pages = []

    def walk(node):
        node = doc.resolve(node)
        if not isinstance(node, dict):
            return
        if str(node.get("Type")) == "Page":
            pages.append(node)
        for kid in doc.resolve(node.get("Kids")) or []:
            walk(kid)

    if root:
        walk(root)
    if not pages:
        for num in sorted(doc.offsets):
            obj = doc.get(num)
            if isinstance(obj, dict) and str(obj.get("Type")) == "Page":
                pages.append(obj)
    return pages


def pdf_to_text(data):
    doc = PDFDocument(data)
    return "\n".join(chunks_to_text(page_chunks(doc, p)) for p in pdf_pages(doc))


# --------------------------------------------------------------------------
# Report parsing
# --------------------------------------------------------------------------

def to_number(s):
    return float(s.replace(",", "").replace("$", ""))


def normalize_name(name):
    return re.sub(r"\s+", " ", name).strip()


def parse_legacy(text, agency_id, pdf_name):
    """2006-2023 report. Returns one record."""
    year = int(re.search(r"TAX YEAR\s+(\d{4})", text).group(1))
    m = re.search(r"AGENCY\s+(\d{2}-\d{4}-\d{3})\s+(.+?)(?:\s{3,}|\n)", text)
    code, name = m.group(1), normalize_name(m.group(2))
    eav = to_number(re.search(r"AGENCY OVERALL EAV\s+[\d,]+\s+TOTAL\s+([\d,]+)", text).group(1))
    grand = re.search(r"^\s*AGENCY GRAND TOTAL\s+(.+)$", text, re.M)
    numbers = re.findall(r"[\d,]*\.?\d+", grand.group(1))
    total_levy = to_number(numbers[0])
    final_rate = to_number(numbers[-1])
    ext = re.search(r"\d{4}\s+TAX EXTENSION GRAND TOTAL\s+([\d,]+\.\d+)", text)
    extension = to_number(ext.group(1))
    return [{
        "tax_year": year, "agency_id": agency_id, "agency_code": code, "agency_name": name,
        "eav": eav, "total_levy": total_levy, "final_rate": final_rate, "extension": extension,
        "report_format": "legacy", "source_pdf": pdf_name, "note": "",
    }]


TOTALS_LINE = r"\s+([\d,]+)\s+[\d,]+\s+([\d.]+)(?:\s+[\d,]+)?\s+[\d,]+\s+([\d.]+)\s+\$([\d,]+\.\d{2})"


def parse_modern(text, agency_id, pdf_name):
    """2024+ report. Returns one record per agency represented in the PDF."""
    year = int(re.search(r"TAX YEAR\s+(\d{4})", text).group(1))
    m = re.search(r"TAX YEAR\s+\d{4}\s+(\d{2}-\d{4}-\d{3})\s+(.+?)(?:\s{3,}|\n)", text)
    base_code, base_name = m.group(1), normalize_name(m.group(2))
    eav = to_number(re.search(r"TotalEAV\s+([\d,]+)", text).group(1))
    records = []

    def record(aid, code, name, mm, note):
        records.append({
            "tax_year": year, "agency_id": aid, "agency_code": code, "agency_name": name,
            "eav": eav, "total_levy": to_number(mm.group(1)), "final_rate": to_number(mm.group(3)),
            "extension": to_number(mm.group(4)), "report_format": "modern", "source_pdf": pdf_name,
            "note": note,
        })

    if agency_id in FUND_SECTIONS:
        for label, aid in FUND_SECTIONS[agency_id].items():
            words = label.split() + ["FUNDS", "TOTALS"]
            mm = re.search(r"^\s*" + r"\s+".join(re.escape(w) for w in words) + TOTALS_LINE, text, re.M)
            if not mm:
                print("  WARNING: no '%s FUNDS TOTALS' line in %s" % (label, pdf_name), file=sys.stderr)
                continue
            code = base_code if aid == agency_id else "%s-%s" % (base_code[:7], aid[-3:])
            name = base_name if aid == agency_id else base_name + " " + label
            record(aid, code, name, mm,
                   "" if aid == agency_id else "Read from the %s section of the %s report" % (label, base_name))
    else:
        mm = re.search(r"^\s*AGENCY GRAND TOTALS" + TOTALS_LINE, text, re.M)
        if not mm:
            raise RuntimeError("no AGENCY GRAND TOTALS line in %s" % pdf_name)
        record(agency_id, base_code, base_name, mm, "")
    return records


def parse_report(data, agency_id, pdf_name):
    text = pdf_to_text(data)
    if "FUNDS TOTALS" in text and "TotalEAV" in text:
        return parse_modern(text, agency_id, pdf_name)
    return parse_legacy(text, agency_id, pdf_name)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def parse_years(spec):
    years = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            years.extend(range(int(a), int(b) + 1))
        else:
            years.append(int(part))
    return years


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="%d-%d" % (FIRST_YEAR, time.localtime().tm_year))
    ap.add_argument("--out", default="data/oak-park-levies.csv")
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "oak-park-levy-pdfs"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    records = []
    for year in parse_years(args.years):
        reports = list_reports(year)
        if not reports:
            print("%d: no reports published" % year, file=sys.stderr)
            continue
        ids = [r["agencyId"] for r in reports]
        print("%d: %d reports (%s)" % (year, len(reports), ", ".join(ids)), file=sys.stderr)
        for rep in reports:
            pdf_name = "%s_%d.pdf" % (rep["agencyId"], year)
            path = os.path.join(args.cache, pdf_name)
            if not os.path.exists(path):
                with open(path, "wb") as f:
                    f.write(download_pdf(rep, ids))
                time.sleep(0.5)
            with open(path, "rb") as f:
                data = f.read()
            try:
                recs = parse_report(data, rep["agencyId"], pdf_name)
            except Exception as exc:
                print("  ERROR parsing %s: %s" % (pdf_name, exc), file=sys.stderr)
                continue
            for r in recs:
                r["agency_label"], r["agency_type"] = AGENCIES.get(r["agency_id"], (r["agency_name"], rep["agencyType"]))
            records.extend(recs)

    # District 200 proration by EAV share
    village_eav = {r["tax_year"]: r["eav"] for r in records if r["agency_id"] == VILLAGE}
    for r in records:
        r["oak_park_eav_share"] = 1.0
        r["oak_park_extension"] = r["extension"]
        if r["agency_id"] == D200:
            if r["tax_year"] in village_eav and r["eav"]:
                share = village_eav[r["tax_year"]] / r["eav"]
                r["oak_park_eav_share"] = round(share, 6)
                r["oak_park_extension"] = round(r["extension"] * share, 2)
                r["note"] = ("District 200 also serves River Forest; eav/extension are the full district, "
                             "oak_park_extension is prorated by Oak Park's share of District 200 EAV")
            else:
                r["note"] = "District 200 also serves River Forest; full-district figures (no Village EAV to prorate)"

    records.sort(key=lambda r: (r["tax_year"], r["agency_id"]))
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        w.writeheader()
        for r in records:
            row = dict(r)
            row["eav"] = "%d" % r["eav"]
            row["total_levy"] = "%d" % r["total_levy"]
            row["final_rate"] = ("%.6f" % r["final_rate"]).rstrip("0").rstrip(".")
            row["extension"] = "%.2f" % r["extension"]
            row["oak_park_extension"] = "%.2f" % r["oak_park_extension"]
            w.writerow(row)
    print("Wrote %d rows to %s" % (len(records), args.out), file=sys.stderr)


if __name__ == "__main__":
    main()
