# Person C: rules, sample data, data checks, QA, demo, README

No coding needed. You write two JSON files by hand (or ask Claude to format them), check data on
a real map, test the live site and own the demo.

**Read first:** [`00-shared-contracts.md`](00-shared-contracts.md) §4 (the exact JSON shapes)
and `HANDOFF.md` §1, §2, §3, §7, §10.

**You own:** `web/data/block-party-rules.json`, `web/data/sample.json`, `README.md`,
`tasks/demo-script.md`, `tasks/qa-log.md`. Don't edit anything else. If you can't use git, send
files to A or B and they push them.

Validate any JSON before pushing: `python3 -m json.tool web/data/sample.json > /dev/null`
(no output means it's valid). A broken JSON file breaks the whole site.

## Step 1 (12:00–12:20): `web/data/block-party-rules.json`, push

Copy the shape from the contracts file. Take the values from the Village page
(https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales) and
`HANDOFF.md` §3. The `checklist` is 8–10 short plain-language lines a resident can tick, e.g.:
- Street runs north/south (east/west streets aren't closed)
- Petition signed by at least 10 separate addresses (block sale: 75% of homes, both sides)
- Petition in at least 2 weeks before the event
- Event between 9 a.m. and 11 p.m., April 4 – October 31
- No more than 2 events on this block this year
- No alcohol sales
- Tables and items stay in the curb parking lane; nothing strung across the street
- Barricades are delivered the day before (Friday for weekend events)

## Step 2 (12:20–1:00): `web/data/sample.json`, push

Everything fictional: names like "Sample Organizer A", "Sample Neighbor 7". **No real business
names** (don't copy from the business-licenses file). Use these real eligible block ids (checked
against the data):

| Block id | Note |
|---|---|
| `S CUYLER AVE\|1100` | demo hero block (55 trees) |
| `HIGHLAND AVE\|1100` | 103 m from Cuyler: same weekend → clustering |
| `S HARVEY AVE\|1100` | |
| `S ELMWOOD AVE\|1100` | |
| `S LOMBARD AVE\|1100` | |
| `S SCOVILLE AVE\|1100` | shady (56 trees) |
| `S TAYLOR AVE\|1100` | |
| `S EAST AVE\|600` | shady |

Write:
- **8 requests** (`r1`–`r8`), dates in the **2027 season** (Apr–Oct 2027). `r1` (Cuyler) and
  `r2` (Highland) on the same weekend, starting Saturday 2027-06-12. Mix statuses: mostly
  `Submitted`, two `Approved`, one `Rejected`. One `kind: "sale"`. Most with `vendor_wanted: true`.
- **5 vendors** (`v1`–`v5`): "Sample Ice Cream Co." (capacity 150), "Sample Taco Cart",
  "Sample Bounce House Rentals", "Sample Face Painting", "Sample BBQ Truck". Make one
  `approved: false` so the Village can approve it in the demo.
- **4–6 bids** on `r1`–`r4`. Include one whose menu mentions "beer" so the alcohol flag shows.
- **Signatures**: `r1` gets 9 (so the demo signs the 10th live), `r2` gets 10, `r3` gets 4.
  Each with a fictional name and a house number on that block (e.g. 1101–1199).
- **2–3 comments** on `r1`.
- `background_weekend_counts`: `{ "2027-06-12": 10, "2027-07-10": 28 }`. With r1 and r2 that
  makes 12/30 for the demo weekend; the July one lets us show the cap getting close.

## Step 3 (1:00–1:30): check 10 segments' direction on a real map

The app decides north/south from each street's endpoints; curved streets can be wrong. Once A's
`blocks.json` is live, pick 10 blocks (include 3 curvy-looking ones), open each on Google Maps or
OpenStreetMap, and record in `tasks/qa-log.md`: block, app says N/S or E/W, map says, match?
Report mismatches to A.

## Step 4 (1:30–2:10): QA on the live site + demo script

- Go through every box in `HANDOFF.md` §9 on https://dsvs12.github.io/block-party-in-a-box/
  (phone and laptop). Log pass/fail in `tasks/qa-log.md` and tell A or B about failures right away.
- Check every form has the "Demo only" banner and every view has the footer.
- Write `tasks/demo-script.md`: the 2-minute demo from `HANDOFF.md` §10, as numbered clicks with
  exactly what to type (e.g. "1100 S Cuyler Ave", start 2027-06-12, end 2027-06-26), what to
  say at each step, and the closing "next steps" line. Include "click Reset demo before starting".

## Step 5 (2:10–2:30): README + rehearse

- Rewrite `README.md` in the event's five-heading format (use the `hackathon-readme` template if
  the event provided one). Must include: the civic question, the live site link, data sources,
  the verified findings from `HANDOFF.md` §1 (say "segments", never "39% of Oak Park"), what is
  real vs. sample data, and "Prototype, not an official Village of Oak Park product."
- Rehearse the demo twice with the live site and time it.

## Done means

- [ ] Rules and sample JSON valid and live; all people and vendors fictional; no real business names.
- [ ] 10-segment direction check logged.
- [ ] QA log covers every §9 acceptance check.
- [ ] Demo script written and rehearsed under 2 minutes.
- [ ] README final, with the live link.
