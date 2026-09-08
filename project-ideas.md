# Day in Our Data: Project Ideas

This guide provides starter challenges for the **Day in Our Data** civic hackathon. The projects are designed to help residents explore Oak Park data and turn it into useful analyses, maps, stories, and tools.

Most ideas are scoped so that a small team can produce a meaningful minimum viable demo in approximately **two to three hours**. Teams are welcome to choose one of these challenges, adapt one, combine multiple ideas, or pursue a different civic question.

Seven directions from this list and the organizer discussions that followed have been developed into [starter-project briefs](starter-projects/README.md) with cached data and a table on event day. Ideas marked **now a starter table** below point to the brief. Every other idea here is a ready-made starting point for a [pitch-your-own](starter-projects/00-pitch-your-own.md) team.

## What a Strong Project Should Do

A strong Day in Our Data project should be able to answer five questions:

1. **Who is the user?** Identify the resident, commission, Village team, or community organization that could use the result.
2. **What civic question does it answer?** Start with a question or need, rather than a technology.
3. **What does the data show?** Produce a working analysis, visualization, story, or prototype.
4. **What could happen next?** Explain how the result might inform a decision, improve access, or invite further investigation.
5. **What are the limitations?** Clearly identify missing, old, incomplete, sensitive, or potentially misleading data.

## Data-Readiness Labels

- **Ready now:** Public structured data or an accessible ArcGIS service is available.
- **Organizer preparation recommended:** The source is public, but teams will benefit from a prepared CSV, GeoJSON, or simplified extract.
- **Approval or aggregation required:** The subject involves privacy, public safety, health, or detailed infrastructure data. Teams should only use an organizer-approved, appropriately aggregated dataset.

## Featured Challenges

These projects offer a strong combination of civic relevance, feasible scope, useful data, and variety of technical skills.

### 1. Alley Repair Reality Check

**Civic question:** Are the alleys in the worst condition being prioritized for reconstruction?

**Minimum viable demo:**

- Compare the recorded 2024 Pavement Condition Index with proposed alley reconstruction projects.
- Map the lowest-rated alleys that are not currently included in the reconstruction plan.
- Create a simple chart showing the condition of scheduled and unscheduled alleys.

**Possible stretch goals:**

- Compare the 2022–2023 and 2024 ratings to identify improving or deteriorating segments.
- Examine whether reconstruction priority is related to condition, alley age, surface, or geography.
- Create an address lookup showing nearby alley conditions and planned work.

**Data:**

- [Alley Condition Ratings and Reconstruction Priorities](https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77)
- [2026 Capital Improvements](https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)

**Potential users:** Transportation Commission, Public Works, residents

**Difficulty:** Intermediate

**Readiness:** Ready now

---

### 2. Accessible Transit and Bus Stop Gaps

**Civic question:** Which Oak Park bus stops should be prioritized for accessibility or shelter improvements?

**Minimum viable demo:**

- Identify Pace bus stops within Oak Park that do not have a shelter or recorded ADA accessibility.
- Map those stops alongside older-adult, disability, and no-vehicle demographic indicators.
- Produce a transparent prioritization score and a shortlist of candidate locations for further review.

**Possible stretch goals:**

- Add CTA and Metra stations and calculate approximate walking access.
- Include parks, schools, libraries, or other frequently visited destinations.
- Create an accessible, mobile-first interface for finding nearby transit options.

**Data:**

- [Modes of Transportation](https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570)
- [Social Vulnerability](https://www.arcgis.com/home/item.html?id=18fee8d54a4348e88775e74af99defd2)
- [Municipal Boundary](https://www.arcgis.com/home/item.html?id=6c1807a7ef5d4d77a9fbb1801d9d36d1)

**Potential users:** Disability Access Commission, Aging in Communities Commission, Transportation Commission

**Difficulty:** Intermediate

**Readiness:** Ready now, but demographic data should be clearly dated

---

### 3. Can I Park Here Right Now?

**Civic question:** Can Oak Park parking rules be made easier to understand at a specific place and time?

**Minimum viable demo:**

- Let a user select an address or location, day, and time.
- Display the relevant parking restrictions in plain language.
- Show available information about permits, payment, enforcement hours, duration, accessible spaces, overnight rules, and EV charging.

**Possible stretch goals:**

- Add a map of nearby municipal lots, garages, accessible spaces, and EV chargers.
- Generate a shareable or printable parking summary.
- Test the wording and interface for accessibility and multilingual use.

**Data:**

- Parking-restriction and facility layers in [Modes of Transportation](https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- [Overnight Parking Map](https://www.arcgis.com/home/item.html?id=f9735ab3100c45de87045b2f95a4ea11)

**Potential users:** Residents, visitors, Transportation Commission, Disability Access Commission

**Difficulty:** Intermediate

**Readiness:** Ready now

> This should be presented as an informational prototype, not an authoritative legal determination.

---

### 4. Oak Park Urban Forest Resilience

**Civic question:** Where is Oak Park's public tree population diverse and resilient, and where is it overly dependent on a small number of species?

**Minimum viable demo:**

- Calculate tree-species diversity by block, street, or grid area.
- Identify places where a single species represents a large share of recorded trees.
- Use diameter, height, and spread as simple size and shade indicators.

**Possible stretch goals:**

- Create a resident-facing “trees near me” explorer.
- Estimate approximate canopy area using recorded tree spread.
- Compare tree distribution with recreation areas or demographic indicators.
- Suggest candidate areas for further field assessment or planting analysis.

**Data:**

- [Oak Park Tree Inventory](https://www.arcgis.com/home/item.html?id=792e798104b140c3b8063e86dc09d991)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- [Municipal Boundary](https://www.arcgis.com/home/item.html?id=6c1807a7ef5d4d77a9fbb1801d9d36d1)

**Potential users:** Environment & Energy Commission, Public Works, residents

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now

> The public tree layer includes species, diameter, height, and spread. It should not be used to make claims about tree age or health unless additional fields are provided.

---

### 5. Oak Park Architecture Explorer and Walking Tour

**Civic question:** How can Oak Park's architectural history be made easier for residents and visitors to explore?

**Minimum viable demo:**

- Let users search or filter historic resources by architect, architectural style, construction period, designation, or location.
- Display images, historical summaries, and available source material.
- Generate a small walking tour near a selected starting point, such as Dole Branch Library.

**Possible stretch goals:**

- Offer themed tours such as Prairie School, Victorian-era buildings, women architects, or neighborhood history.
- Create an architecture quiz or scavenger hunt for students and families.
- Compare resources inside and outside designated historic districts.
- Generate a printable or mobile-friendly tour card.

**Data:**

- [Historic Building Dataset](https://www.arcgis.com/home/item.html?id=5a02234ddbed497a809810430a61853a)
- [Historic Districts](https://www.arcgis.com/home/item.html?id=d3ff666dfb764e8183879667acce810e)
- [Historic Survey Areas](https://www.arcgis.com/home/item.html?id=315557a64ac84d45b71e55d94fd583ac)

**Potential users:** Historic Preservation Commission, schools, residents, visitors

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now

---

### 6. Open Data Portal Report Card

**Civic question:** How easy is it for residents and developers to find, understand, download, and reuse Oak Park's public data?

**Minimum viable demo:**

- Inventory the portal's catalog entries.
- Test whether each entry has a working public link, direct download or API, useful description, update date, and understandable fields.
- Identify duplicate, legacy, inaccessible, or dashboard-only entries.
- Produce a prioritized list of improvements.

**Possible stretch goals:**

- Build an automated link and API health checker.
- Create a simple metadata completeness score.
- Design a prototype data catalog with filters for subject, format, update cadence, and responsible department.
- Recommend a standard publication checklist for future datasets.

**Data:**

- [Oak Park Open Data Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/)
- [Portal catalog group](https://www.arcgis.com/sharing/rest/content/groups/f84dd7a1fcd14a28850e52aa5595dbb2/search?f=pjson&num=100)
- [Day in Our Data repository](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data)

**Potential users:** Civic Information Systems Commission, Village data publishers, residents, civic developers

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now

## Additional Ready-to-Use Challenges

### 7. One Address, Three Collection Answers

**Civic question:** Can residents get garbage, recycling, and yard-waste information from one simple address search?

**Minimum viable demo:** Return collection days, pickup location, container requirements, seasonal dates, accepted materials, and other available instructions for a selected address.

**Stretch goal:** Generate a calendar reminder or printable refrigerator card.

**Data:**

- [Garbage Collection Area](https://www.arcgis.com/home/item.html?id=f37a61a2da404835b1ca249e1309daf6)
- [Recycling Collection Area](https://www.arcgis.com/home/item.html?id=e7e664360cd742e3b8075e14698a364a)
- [Yard Waste Collection Area](https://www.arcgis.com/home/item.html?id=8b527d0e884746edaa7258b1db225874)

**Potential users:** Residents, Environment & Energy Commission

**Difficulty:** Beginner

**Readiness:** Ready now

---

### 8. Capital Projects Near Me

**Civic question:** What public construction has happened, is happening, or is planned near a resident's home, business, or daily route?

**Minimum viable demo:** Search an address and display nearby street, alley, water, sewer, bicycle, signal, and streetscape projects by year and type.

**Stretch goal:** Create a timeline or identify locations where multiple projects could be coordinated.

**Data:**

- [Capital Improvements application](https://www.arcgis.com/home/item.html?id=56c706bcad1141e6875c38ec5e690a94)
- [2026 Capital Improvements map](https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)

**Potential users:** Residents, Public Works, Transportation Commission

**Difficulty:** Intermediate

**Readiness:** Ready now; a prepared multi-year extract would simplify the work

---

### 9. Transit and Zoning Opportunity Explorer

**Civic question:** What types of development currently exist or are permitted near Oak Park's major transit stations?

**Minimum viable demo:** Create walking-distance buffers around CTA and Metra stations and summarize zoning categories, building footprints, and the People Over Parking Act area within them.

**Stretch goal:** Compare current building form with zoning or create scenarios for discussion. The project should present evidence and tradeoffs rather than make definitive planning recommendations.

**Data:**

- [Zoning Districts](https://www.arcgis.com/home/item.html?id=acf2aa126e404129b62378cdc0cc1a8d)
- [Modes of Transportation](https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570)
- [Building Poly](https://www.arcgis.com/home/item.html?id=ec018598714f497581ed750267d4797b)

**Potential users:** Plan Commission, Zoning Board of Appeals, Housing Programs Advisory Committee

**Difficulty:** Advanced

**Readiness:** Ready now

---

### 10. Greening Opportunity Map

**Civic question:** Which parts of Oak Park have the greatest imbalance between built or paved surfaces and public trees or recreation space?

**Minimum viable demo:** Aggregate building footprints, street area, recreation land, and estimated tree spread into a block- or grid-level “hardscape versus shade” indicator.

**Stretch goal:** Add demographic context or create a transparent candidate list for further green-infrastructure assessment.

**Data:**

- [Building Poly](https://www.arcgis.com/home/item.html?id=ec018598714f497581ed750267d4797b)
- [Streets Centerlines and Street Polygons](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- [Recreation Poly](https://www.arcgis.com/home/item.html?id=4e770e3fa181404eb6f919d22d9e484a)
- [Oak Park Tree Inventory](https://www.arcgis.com/home/item.html?id=792e798104b140c3b8063e86dc09d991)

**Potential users:** Environment & Energy Commission, Plan Commission, Public Works

**Difficulty:** Advanced

**Readiness:** Organizer preparation recommended

---

### 11. Commission and Data Matchmaker

**Now a starter table:** see [What do our commissions do?](starter-projects/05-what-do-our-commissions-do.md) (brief 05).

**Civic question:** Which Village commission should a resident approach about an issue, and what public data could help frame the discussion?

**Minimum viable demo:** Let a resident describe an issue and return the most relevant commission, its purpose, meeting schedule, link, and related portal resources.

**Stretch goal:** Add an event calendar, reminders, a guided question builder, or an AI-assisted search that cites its sources.

**Data:**

- [Oak Park commissions directory](commissions-diod.csv)
- [Oak Park Open Data Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/)

**Potential users:** Citizen Involvement Commission, CISC, residents

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now

## Challenges Requiring Organizer-Provided Data

The following ideas use public dashboards or sensitive subject areas. They should only be offered if organizers provide a documented, appropriately reviewed data extract.

### 12. Vision Zero Coverage Gap Finder

**Now a starter table:** the school-route version is [Can a kid bike to school safely?](starter-projects/03-can-a-kid-bike-to-school-safely.md) (brief 03). The crash data is prepared: `data/crashes-village-oak-park.csv` (the Traffic Crash Dashboard export this idea asked for, Jan 2024 on), `data/crashes-oak-park.csv` (IDOT, 2019 to 2025), and `data/crashes-bike-ped-oak-park.csv`.

**Civic question:** Are recent serious-crash locations being addressed by planned or completed safety improvements?

**Minimum viable demo:** Overlay crashes by severity and type with RRFBs, traffic-calming work, bicycle improvements, schools, parks, and capital projects.

**Data needed:**

- An organizer-provided CSV or GeoJSON export from the [Traffic Crash Dashboard](https://opendata.oak-park.us/TrafficCrash)
- Capital improvement and transportation layers
- Recreation and school locations

**Potential users:** Transportation Commission, Public Works, Vision Zero team

**Difficulty:** Advanced

**Readiness:** Organizer preparation required

---

### 13. Permit and Preservation Activity

**Civic question:** What patterns can be found in building activity near historic resources, historic districts, and different zoning areas?

**Minimum viable demo:** Summarize permit counts, project types, values, and trends by area, then compare them with historic and zoning geography.

**Data needed:**

- An organizer-provided export from the [Building Permit Dashboard](https://opendata.oak-park.us/BuildingPermit)
- Historic building, historic district, zoning, and building-footprint data

**Potential users:** Historic Preservation Commission, Plan Commission, Building Codes Advisory Commission

**Difficulty:** Intermediate

**Readiness:** Organizer preparation required

---

### 14. Oak Park Business Pulse

**Civic question:** Where is business activity growing, changing, or declining across Oak Park's commercial areas?

**Minimum viable demo:** Analyze new and canceled licenses by year, business category, and corridor or district.

**Stretch goal:** Compare business-license activity with building permits, zoning, transit, or capital projects.

**Data needed:**

- An organizer-provided export from the [Business License Dashboard](https://opendata.oak-park.us/BusinessLicense)
- Optional building permit, zoning, and transportation data

**Potential users:** Village economic vitality staff, Plan Commission, business districts

**Difficulty:** Intermediate

**Readiness:** Organizer preparation required

---

### 15. ECHO Community Needs and Resource Gaps

**Civic question:** What types of community needs are being encountered by the ECHO program, and where might service partnerships or resources be strengthened?

**Minimum viable demo:** Visualize deidentified, aggregated ECHO service categories and trends and compare them with a public directory of community resources.

**Data needed:**

- An organizer-approved, deidentified aggregate export from the [ECHO Activity Dashboard](https://opendata.oak-park.us/EchoActivity)
- A reviewed list of relevant public services and community resources

**Potential users:** Board of Health, Aging in Communities Commission, Community Relations Commission, ECHO team

**Difficulty:** Intermediate

**Readiness:** Approval and aggregation required

---

### 16. Lead Service Line Outreach Scorecard

**Civic question:** At an aggregated geographic level, where is additional verification, education, or replacement outreach most needed?

**Minimum viable demo:** Summarize lead, galvanized-requiring-replacement, and unknown service-line status by block group or another approved area and compare it with relevant housing or demographic indicators.

**Data needed:**

- An organizer-approved extract from the [Water Service Inventory Dashboard](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/c0ae2079a04840deaeb007c9f29ae6b7/explore)
- Approved housing or demographic data

**Potential users:** Board of Health, Housing Programs Advisory Committee, Public Works

**Difficulty:** Advanced

**Readiness:** Approval and aggregation required

> Do not publish address-level household status, outreach history, testing participation, or other sensitive attributes. The public demo should use only organizer-approved, aggregated information.

## Ideas to Reframe Rather Than Duplicate

Several early project concepts now overlap with tools that the Village has already published. Instead of rebuilding the same dashboard, teams should ask a new question or combine datasets.

| Existing tool or broad idea | Stronger hackathon framing |
| --- | --- |
| Generic crime dashboard | Investigate a clearly defined, responsibly framed question that the existing dashboard does not answer. Avoid predictive policing or neighborhood-stigmatizing outputs. |
| Generic traffic crash dashboard | Compare crashes with safety investments, transit access, schools, parks, or the Vision Zero plan. |
| Generic building permit dashboard | Connect permit activity with historic resources, zoning, business activity, or capital investment. |
| Generic business license dashboard | Analyze openings, closures, categories, corridors, or relationships with permits and transit. |
| Broad “shadow municipal dashboard” | Select one measurable civic question and build a transparent, maintainable indicator around it. |
| Social-media sentiment analysis | Prefer public comments, surveys, or other consent-aware sources. Clearly address representativeness and platform bias. |
| Assessor-site scraping | Provide a prepared extract or documented source so teams spend the event analyzing rather than troubleshooting a fragile scraper. |
| Budget OCR or meeting transcription | Pre-stage the source documents or media, expected output format, and a small target corpus. |

## Organizer Data-Preparation Checklist

Before the event, organizers should consider completing the following:

- [ ] Publish a simple data catalog with a direct download or API link for every approved source.
- [ ] Provide CSV and GeoJSON starter files for participants who are not familiar with shapefiles or ArcGIS services.
- [ ] Include a short data dictionary, update date, source department, geographic scope, and known limitations for every dataset.
- [ ] Create approved exports for dashboard-only sources such as crashes, crime, permits, business licenses, and ECHO activity.
- [ ] Review lead-service, public-safety, health, and detailed water/sewer data for privacy and infrastructure-safety concerns.
- [ ] Refresh or clearly date demographic data. The current Social Vulnerability map references 2014–2019 ACS estimates.
- [ ] Prepare simplified subsets of the large, multi-layer Water and Sewer System Data download if it will be used.
- [ ] Verify that every featured portal and dataset link works without an account.
- [ ] Correct descriptions that promise fields not present in the public data.
- [ ] Add one example query, notebook, or starter application for common ArcGIS data-access patterns.
- [ ] Identify a subject-matter contact or commission representative for each featured challenge.

## Suggested Challenge-Card Template

Organizers and community partners can use this template to propose additional challenges:

```markdown
### Project title

**Civic question:** What specific question should the project answer?

**Why it matters:** Who experiences the problem, and what could improve?

**Minimum viable demo:** What can a team reasonably show by the end of the event?

**Possible stretch goals:** What could be added if time permits?

**Data:** Link directly to approved datasets and documentation.

**Potential users:** Which residents, commissions, departments, or organizations could use the result?

**Difficulty:** Beginner, intermediate, or advanced

**Readiness:** Ready now, organizer preparation recommended, or approval/aggregation required

**Important caveats:** Note privacy, quality, age, completeness, or interpretation concerns.
```

## Contributing

Additional project ideas are welcome. Proposed challenges should identify a real civic user or need, link to usable data, fit the event's build window, and clearly disclose important limitations.
