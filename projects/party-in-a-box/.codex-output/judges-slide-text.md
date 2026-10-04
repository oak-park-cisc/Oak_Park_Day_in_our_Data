# Party in a Box: judge demo

Use six slides for a roughly two-minute pitch. Put one screenshot on each of slides 3–5. Use forest green, warm white and large type. Keep the screenshots' illustrative-demo labels visible.

## Slide 1 — Party in a Box

**An easier way to plan an Oak Park block party**

One place for residents, vendors and Village reviewers.

Day in Our Data · October 3, 2026

Say: “A block party should bring neighbors together. We built Party in a Box to make the planning easier, while helping reviewers keep busy streets open.”

## Slide 2 — Public data makes the first step clearer

**887** street-and-hundred-block segments

**342** east/west segments excluded by the closure rule

**441** likely eligible segments under our main-street assumptions

An address becomes a block check, a reason and a nearby alternative when needed.

Small source line: Computed from the hackathon street dataset. Main-street exclusions use our assumed list.

Say: “We turn public street data into a useful answer before a resident starts the paperwork. These are segments, not a percentage of Oak Park. Our main-street list is an assumption for Village review.”

## Slide 3 — Residents see what to do next

**Check a block. Pick dates. Start a petition.**

Eligibility, deadlines and requested services stay with the event.

Screenshot: Resident screen

Say: “Here’s our illustrative resident journey on 1100 South Cuyler. The source data shows 55 trees, including 18 large trees. The organizer chooses a date range and sees the petition deadline, then requests barricades and the Green Block Party kit.”

## Slide 4 — Vendors find parties that fit

**A clear service offer for a specific event**

Availability, service area and capacity explain the match.

The vendor chooses whether to accept.

Screenshot: Vendor screen

Say: “A fictional ice cream vendor can see why this event fits its offer. The price is a quote for the vendor’s service. This connects the organizer’s event details with the vendor’s capacity.”

## Slide 5 — Reviewers see the reasons

**Petition readiness and closure impact in one view**

Signature count and weekend capacity support review.

Traffic impact includes its rule-based reasons.

The Village reviewer chooses the date and decision.

Screenshot: Village screen

Small disclosure: Sample requests and counts. Traffic impact is a rule-based score, not measured traffic or delay.

Say: “The reviewer sees the petition count, the sample weekend total and the reasons behind the impact rating together. Public data informs the checks, while the reviewer makes the decision. We do not claim to predict traffic delay.”

## Slide 6 — A practical next step for Oak Park

**Pilot the workflow with Public Works**

Confirm the rules and main-street exclusions.

Publish approved events and weekend counts as open data.

Explore a VillageView connection.

Demo: https://dsvs12.github.io/block-party-in-a-box/

Small disclosure: Prototype, not an official Village of Oak Park product. Screens use fictional sample data. Rules shown are 2026; confirm 2027 with Public Works.

Say: “Our next step is a small Public Works pilot. Confirm the rules, make weekend capacity available as open data and explore whether VillageView can connect. We want neighbors to spend less effort organizing the process and more time enjoying the party.”

## Judge Q&A

- Are the screens real? These presentation screens are illustrative mockups of the intended prototype workflow, using fictional sample events and vendors.
- What is verified? The repository's reference script reproduces 887 segments, 342 east/west segments and 441 likely eligible segments. It also reproduces the Cuyler tree counts.
- What needs a pilot? Village acceptance of the workflow, current rules, official signatures, real accounts, notifications and a permitting integration.
- Is traffic AI deciding approval? No. The proposed impact score uses explicit rules and shows reasons. A reviewer makes the decision.

## Sources

- Repository README.md and HANDOFF.md
- scripts/probe_reference.py, run October 3, 2026
- Hackathon data: https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data
- Village rules source referenced by the project: https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales

## Screenshot generation

Built-in image generation. Prompts: create flat 16:9 desktop screenshots in a consistent white, cream and forest-green civic design, with crisp sans-serif text, no device frames or municipal seals, and a visible “ILLUSTRATIVE DEMO · SAMPLE DATA” banner. Resident: Cuyler block eligibility, verified tree counts, sample dates, petition deadline and services. Vendor: fictional Sample Ice Cream Co., $250 illustrative offer, capacity 150 and sample matched jobs. Village: sample petition 10/10, sample weekend 12/30, medium illustrative rule-based impact with reasons and reviewer controls.
