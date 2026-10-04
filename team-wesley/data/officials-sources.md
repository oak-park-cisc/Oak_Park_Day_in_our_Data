# Oak Park elected officials: sources and notes

Retrieved: 2026-10-03. Every roster came from the body's own official website, fetched directly that day. No names were taken from secondary sources.

## Rosters

| Body | Count | Source | Photos |
|---|---|---|---|
| Village Board | 8 (President, 6 Trustees, Clerk) | https://www.oak-park.us/Government/Leadership/Village-Board | 0 of 8 |
| District 97 Board | 7 | https://www.op97.org/boe/meet-the-board | 7 of 7 |
| District 200 Board | 7 | https://www.oprfhs.org/about/board-of-education | 0 of 7 (the page has no headshots) |
| Park District Board | 5 | https://pdop.org/about/parkboard/ | 5 of 5 |
| Library Board | 7 | https://www.oppl.org/about/board-of-trustees/ | 7 of 7 |
| Township | 7 (Supervisor, 4 Trustees, Clerk, Assessor) | https://oakparktownship.org/board-agendas-finances/ | 0 of 7 (the page has no headshots) |

Total: 41 officials. 19 have photos.

## Photo verification

- Every non-null `photoUrl` returned HTTP 200 with an `image/jpeg` or `image/png` content type from `curl -sI` on 2026-10-03.
- **Village of Oak Park:** The Village Board page shows headshots for all 8 officials, under `/files/assets/oakpark/...` and `/files/content/oakpark/...`. From this environment, every image request returned HTTP 403 "Access Denied" from the site's Akamai CDN. That happened with HEAD and GET requests, and with or without a Referer header. Because the URLs could not be verified, they are set to null. They may load fine in a normal browser. To add them later, the image paths are in the page source.
- **District 97:** Image links on op97.org (for example `/boe/files/images/...`) redirect (302) to the district's file storage at `campussuite-storage.s3.amazonaws.com/prod/735181/...`, the CampusSuite CMS the district uses. The JSON stores the final S3 URLs because those return 200 directly. Holly Spurlock's photo was uploaded around 2017, so it may be older than the others.
- **Park District:** The page shows resized thumbnails, for example `chris-headshot-2-252x300.png`. The JSON uses the full-size originals, which are the same files without the size suffix. Both versions were verified.

## Notes and uncertainties by body

- **Village Board:** Derek Eder was appointed in June 2025 to finish former Trustee Susan Buchanan's term, which ends April 2027. All other officials were elected. Brian D. Straw and Cory J. Wesley have terms ending April 2027. Scaman, Enyia, Leving Jacobson, Taglia, and Waters have terms ending April 2029.
- **District 97:** Vincent Gay was appointed in June 2026 after Becky Pérez resigned in May 2026, and he serves until April 2027. Sources: the meet-the-board page and https://www.op97.org/news/1827835/vincent-gay-appointed-as-new-member-of-district-97-board-of-education. Lee-Ann Roskopf also appears on the page as "Board Secretary," but she is district staff (executive assistant to the superintendent), not an elected member, so she is excluded. Officers listed: Cheree Moore (President) and Jung Kim (Vice President).
- **District 200:** The roster page lists names, officer roles, and term years, but no residence. `residence` is therefore omitted for every member, as instructed. The board serves both Oak Park and River Forest. Tim Brandhorst's entry on the page has no role label, while every other non-officer is labeled "Member." He is recorded as "Member." The page writes "Dr." before Jonathan Livingston and Kathleen Odell. The JSON leaves the title out of `name`. The page's mention of "Clerk of the Board Lisa Evans" refers to staff, so she is excluded.
- **Park District:** The page lists "Kassie Porreca, Secretary," and her bio says "Kathleen Porreca." The JSON uses the display name "Kassie Porreca." The page also says three seats are up in the April 6, 2027 election.
- **Library Board:** Board roles are taken as listed: President, Vice President, Finance Officer, Secretary, and Trustee. Kristina Rogers's photo was uploaded in January 2026, which suggests she joined recently. The page does not say whether she was appointed or elected.
- **Township:** The roster section is titled "Current Oak Park Township Elected Officials and Appointed Officials." It lists Supervisor, 4 Trustees, Clerk, and Assessor, all with terms ending 2029. No Collector is listed, so none is included. The page writes "Dr." before Margaret Trybus, and the JSON leaves it out of `name`.
- No body was omitted, because every roster page was retrieved successfully.

## bodies.json fact sources

- Village: https://www.oak-park.us/Government/Leadership/Village-Board (manager form of government, President plus 6 trustees, 4-year staggered terms, April elections in odd years)
- D97: https://www.op97.org (school list: Beye, Hatch, Holmes, Irving, Lincoln, Longfellow, Mann, and Whittier elementary schools; Brooks and Julian middle schools), plus the meet-the-board page. The seat count of 7 and the four-year terms come from the member bios. The page does not state them outright.
- D200: https://www.oprfhs.org/about/board-of-education (7 elected members, policy role, IASB 2025 governance recognition)
- Park District: https://pdop.org/about/ (since 1912, 5 elected officials, 18 parks totaling 84 acres, facilities, about 8,000 programs a year)
- Library: https://www.oppl.org/about/board-of-trustees/, https://www.oppl.org/about/, and https://www.oppl.org/about/locations-hours/
- Township: https://oakparktownship.org/board-agendas-finances/ and the service pages for assessor, senior, youth and family, general assistance, and community mental health

## Later additions

- 2026-10-03: Cory J. Wesley's photo URL was supplied by the team. It is the Village Board page headshot, https://www.oak-park.us/files/content/oakpark/v/46/government/leadership/village-board/wesley.jpg?w=1441&h=2160. From this workspace it returns 403, like the other Village headshots, so it could not be verified here. If it fails to load in the browser, the game falls back to the cartoon avatar.
- 2026-10-03: Photo URLs for the other 7 Village Board members were read from the Village Board page source with a page-reading tool. The Wesley URL found there matched the one the team supplied. Direct image requests from this workspace still return 403, so these were not verified here; the game falls back to the cartoon avatar if one fails in the browser.
