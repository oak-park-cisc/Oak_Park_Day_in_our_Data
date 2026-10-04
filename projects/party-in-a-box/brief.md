# Party in a Box

## Oak Park’s block-party process, redesigned around a simple promise

**A resident should be able to ask, “Can we close our block this summer?” and get a clear, useful answer in minutes—not after navigating rules, PDFs, phone calls, vendor coordination, and an opaque approval process.**

Party in a Box is the missing civic layer between a neighborhood’s excitement and Public Works’ responsibility. It turns a block-party request into one connected experience for the three people who make it happen:

| Resident | Vendor | Village reviewer |
| --- | --- | --- |
| Find an eligible block, choose dates, gather signatures, and track the request. | Set an offer and accept only events that fit capacity, availability, and service area. | Review a decision-ready queue with every rule, conflict, and traffic factor explained. |

This is not a prettier permit form. It is a shared operating system for community events: easier to use on the front end, more accountable on the back end, and built from the public data Oak Park already has.

## One delightful journey, from “yes” to approval

Imagine a resident planning a summer party at **1100 S Cuyler Ave**.

1. They enter their address and immediately see whether the block is eligible, along with shade, curb restrictions, nearby planning context, and a map of the actual street segment.
2. They select a date range. The app calculates the petition deadline, validates the season, and surfaces the rules before time is wasted.
3. They create a petition link and watch progress toward the required 10 distinct addresses.
4. Once ready, the request moves to a reviewer queue—complete with candidate dates, a transparent traffic-impact score, nearby-closure context, weekend capacity, and all approval gates.
5. An approved event becomes visible to matching vendors. Vendors decide whether to take a job that fits their real operating constraints.

The best interaction is the one most civic tools miss: when an address cannot work, Party in a Box does not simply reject the resident. An east/west street receives a plain-language explanation of the Village closure rule **and the nearest eligible alternative**. It transforms “no” into a next step.

## Data that creates decisions, not dashboards

We transformed Oak Park’s published streets, trees, transit, schools, capital projects, parking, and overnight-parking datasets into a block-level planning engine.

The evidence is specific and reproducible:

- **887** street-and-hundred-block segments are indexed for address-level lookup.
- **342** east/west segments are identified as ineligible for closures under the Village rule.
- **441** north/south, non-main-street segments are likely eligible.
- For the **222** residential east/west segments, the nearest eligible alternative is only a **54 m median** away (90th percentile: **126 m**).
- The app turns quality-of-place data into a practical planning signal: 1100 S Cuyler, for example, has **55 trees**, including **18 large trees**.

Those numbers are not decorative. They create a better resident experience and a smarter review process: find a viable block, reveal the trade-offs, and preserve the streets where a closure would create the most disruption.

## Transparent by design

Public decisions deserve visible logic. Party in a Box evaluates published constraints in code and shows the reason behind every result:

- Closure eligibility and closest alternative
- April 4–October 31 season and 9 a.m.–11 p.m. event window
- Two-week petition timing and 10-address threshold
- Two-events-per-block annual limit and 30-event weekend capacity
- Nearby transit, schools, capital projects, and clustered closures

The traffic-impact score is especially intentional. It is a rule-based score with a visible breakdown—not a black box and not a made-up estimate of delay. Reviewers see exactly which conditions raise impact, then compare candidate dates with the weekend cap in view.

AI, where used, is kept in its proper role: it explains the already-computed facts in plain language. It cannot invent numbers or make an approval decision. The human reviewer remains accountable; the product makes that accountability faster, clearer, and easier to defend.

## Built for the day after the hackathon

Party in a Box combines a polished role-based interface with a real service foundation: FastAPI, a PostgreSQL-ready model, role-aware endpoints, audit-friendly review actions, idempotent writes, optimistic locking, and deterministic rule checks. The architecture is ready to grow from a compelling experience into a Public Works pilot.

The next move is concrete: validate the rule set with Public Works, connect the Village’s permit workflow, and publish approved events and weekend-cap counts as open data. Rather than asking Oak Park to replace everything, Party in a Box gives it a clear, incremental path to improve the experience people have today.

## Why this should win

The strongest civic products make government feel both more human and more rigorous. Party in a Box does both.

It gives residents a path forward instead of a dead end. It gives local vendors a respectful, structured way to participate. It gives Village staff transparent evidence instead of scattered forms and guesswork. And it takes public data all the way to an action someone can actually complete.

**Party in a Box makes it easier for Oak Park to say yes—to the right block, on the right date, for the right reasons.**
