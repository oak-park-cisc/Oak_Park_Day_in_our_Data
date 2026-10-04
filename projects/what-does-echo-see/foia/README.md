# FOIA and data requests

Draft requests for the call and outcome data that could show what ECHO changes. The public crime data can't show that; see [../research/crime-and-echo.md](../research/crime-and-echo.md).

**These are drafts.** Nothing in this folder has been sent. A team member reviews each draft, fills in the requester details, and files it. Nothing is ever submitted from this repo.

## Rules for every request

- **Aggregate monthly counts only.** No addresses, names, incident numbers or individual records. That keeps the requests inside the project's privacy rules and makes them easier to grant.
- **Ask the agency to hide counts of 1 to 4** before releasing. That matches how the trends page treats small cells.
- **Ask for existing records.** Illinois FOIA (5 ILCS 140) doesn't require an agency to create new records or analysis. Each draft asks for existing reports, or for a query of an existing database, and asks what standard reports exist if the counts can't be produced as written.
- **Expect about 5 business days** for a response, which the agency can extend.
- **Attach the matching template from [templates/](templates/)** to show the format wanted. Every template row is synthetic and labelled so (see below).

## Who receives each request

Contacts were checked on 2026-10-03 against the [Village FOIA page](https://www.oak-park.us/Government/Information-and-Resources/Freedom-of-Information-Act-FOIA). Re-check them before filing.

| Draft | Send to | How |
| --- | --- | --- |
| [01-police-cad-monthly.md](01-police-cad-monthly.md) | Oak Park Police Department FOIA Officer (Police Records Supervisor), 123 Madison St., 708.386.3800, FOIAPolice@oak-park.us | Email, or the Village's [JustFOIA portal](https://oakpark.justfoia.com/publicportal/home/newrequest) |
| [02-fire-ems-monthly.md](02-fire-ems-monthly.md) | Village Primary FOIA Officer (Village Clerk), 123 Madison St., 708.358.5672, FOIA@oak-park.us. The FOIA page lists no separate Fire Department contact. | Email or JustFOIA portal |
| [03-911-988-transfers.md](03-911-988-transfers.md) | West Suburban Consolidated Dispatch (WestCom), named as Oak Park's dispatch center in the Village's [November 2025 CESSA memo](https://www.oak-park.us/files/assets/oakpark/v/1/village-manager/memos-to-the-village-president/2025/io-2025-11-19-cessa.pdf). **WestCom's FOIA contact is not on a Village page: take it from WestCom's own website before filing.** | Per WestCom |
| [04-echo-outcomes.md](04-echo-outcomes.md) | **First, a direct request** to the ECHO team, echo@oak-park.us. FOIA fallback: Village Primary FOIA Officer, FOIA@oak-park.us. | Email |

## Suggested order

1. **Send 04 to the ECHO team first, as a conversation, not a FOIA.** They are the project's reviewers, and several questions (the 874 vs 702 gap, the September 2025 spike, the timestamp) are easier to answer in person.
2. **File 01 (Police)** next. It has the most value: monthly call types show whether the calls ECHO handles are changing.
3. **File 02 (Fire)** and **03 (WestCom)**.

## Templates and synthetic data

[templates/](templates/) holds one CSV per request, showing the columns and format wanted. **Every row is synthetic:** the first column is `synthetic` with the value `yes`, and every file name starts with `SYNTHETIC-`. The numbers are invented to show the format and to test the analysis code. They describe nothing real.

[prototype-calls.html](prototype-calls.html) charts the templates, so the team can see what the analysis would look like when real data arrives. It carries a SYNTHETIC DATA banner, isn't linked from the trends page, and isn't included in the standalone build. To view it, run `python3 -m http.server` from the repo folder and open http://localhost:8000/foia/prototype-calls.html.

`tests/test_echo.py` checks that every template row is flagged synthetic, and that no synthetic data reaches `data/`, the trends page or the standalone build. When real data arrives, put it in `data/` with a `data/README.md` entry, never in `foia/templates/`.
