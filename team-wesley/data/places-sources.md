# Sources for schools.json, places.json, trivia.json

All sources were retrieved on **2026-10-03**.

## Geocoding method

- **Primary:** OpenStreetMap Nominatim (`nominatim.openstreetmap.org/search`), structured `street` + `city=Oak Park` + `state=Illinois` queries, or name queries for parks. Requests were spaced 1.1 s apart and sent with a custom User-Agent. Most results matched a named OSM feature (building, school, park, or museum) or a county address point.
- **Cross-check:** US Census geocoder (`onelineaddress`, benchmark `Public_AR_Current`) was run on every street address. For buildings, the two results usually agreed within 5-70 m. Census results are interpolated along street segments, so the named OSM feature was preferred when the two differed.
- **Census only:** George L. Smith House, 743 Columbian Ave. Nominatim returned no match.
- **Chester Flitcraft House (845 Chicago Ave):** the first Nominatim result was about 130 m from the Census point. A second Nominatim query, and its neighbors 825/835/857, gave a consistent position that agrees with Census (about 1 m apart). The file uses that position.
- **Parks:** coordinates are the OSM park feature points, not the mailing-address points. Ridgeland Common uses the Paul Hruby Ice Arena feature at 415 Lake St.
- **Lake Street (Downtown):** uses the OSM "Downtown, Oak Park" neighbourhood point, which sits at about Lake St and Marion St.
- **Bounds check:** every coordinate falls inside lat 41.86-41.91, lon -87.81 to -87.77. A script asserted this.

## Schools (schools.json)

- School list, short names, addresses: https://www.op97.org/schools. As of 2026-10-03 the district has 8 elementary schools and 2 middle schools, matching the expected list.
- Official full names come from each school's About page title, https://www.op97.org/{beye,hatch,holmes,irving,lincoln,longfellow,mann,whittier,brooks,julian}/about. Examples: "William Hatch School", "Percy Julian Middle School".
- Mascots come from each school's op97.org home page ("Home of the Bobcats/Tigers/Eagles/Lions/Bears/Mustangs/Wildcats/Eagles"). Holmes is from https://www.op97.org/holmes/about ("School Colors: Black & Red / School Mascot: A Hawk"). Julian is from IESA ("Jayhawks").
- Official colors:
  - Holmes: Black & Red. Source: op97.org/holmes/about.
  - Brooks: Royal Blue & White. Source: https://www.iesa.org/mobile/schools/detail.asp?SchoolID=951
  - Julian: Red & White. Source: https://www.iesa.org/mobile/schools/detail.asp?SchoolID=420
  - OPRF: "Orange & Blue", mascot Siberian Husky. Source: https://www.oprfhs.org/about/about-our-school
  - **All hex values are approximations of the named colors.** The Holmes red (#D02020) was sampled from the school's logo.
- `colors` is **null** for Beye, Hatch, Irving, Lincoln, Longfellow, Mann, and Whittier. No published school colors were found on op97.org, PTO sites, or spirit-wear vendor pages.
  - The optional field `logoAccent` is the main non-gray color sampled from each school's header logo, `https://www.op97.org/files/theme%20files/{school}-logo.png`. These are logo tints, **not** official school colors.
  - Beye and Irving logos are grayscale, so they have no accent.
- OPRF address: 201 N. Scoville Ave per https://www.oprfhs.org/. The Park District listing says "210 North Scoville", which is probably a typo. The file uses the school's own address.

## Places (places.json)

- **Oak Park Village Hall:** https://en.wikipedia.org/wiki/Oak_Park_Village_Hall. Harry Weese, 1975, NRHP 2014.
- **Park District pages** (addresses, history facts, acquisition years):
  - https://pdop.org/parks-facilities/location/scoville-park/
  - https://pdop.org/parks-facilities/location/ridgeland-common-recreation-complex/
  - https://pdop.org/parks-facilities/location/rehm-park-pool/
  - https://pdop.org/parks-facilities/location/austin-gardens/
  - https://pdop.org/parks-facilities/location/mills-park-pleasant-home/
  - https://pdop.org/parks-facilities/location/oak-park-conservatory/
  - https://pdop.org/parks-facilities/location/cheney-mansion/
  - https://pdop.org/parks-facilities/location/taylor-park/
  - https://pdop.org/parks-facilities/location/field-park/
  - Directory: https://pdop.org/parks-facilities/
- **Oak Park Conservatory:** https://en.wikipedia.org/wiki/Oak_Park_Conservatory. 1929, Foley Greenhouse Manufacturing Co.
- **Main Library:** https://www.oppl.org/about/history/main-library-history/. Opened Oct 5, 2003. Architect Nagle Hartray Danker Kagan McKay.
- **Frank Lloyd Wright Trust building pages** (address, date, facts): https://flwright.org/explore/ followed by:
  - oak-park-studio-frank-lloyd-wright, frank-lloyd-wright-home, unity-temple-0
  - arthur-heurtley-house, nathan-g-moore-house, frank-thomas-house, cheney-house
  - laura-gale-house, walter-gale-house, thomas-gale-house, peter-beachy-house
  - george-furbeck-house, balch-house, william-fricke-house, william-e-martin-house
  - hills-house, scoville-park-fountain
  - Index: https://flwright.org/explore/buildings-wrights-chicago-years
  - UNESCO: https://flwright.org/about/unesco
- **Village of Oak Park Historic Landmarks list (updated Feb 7, 2025):** https://www.oak-park.us/files/assets/oakpark/v/1/historic-preservation/resources/oak-park-historic-landmarks-updated-through-february-2025.pdf
  - Source for architect, year, and designation year of the Matthews, Kittle, Schwerin, Flitcraft, G.L. Smith, McCready, and Skiff houses, the First Methodist Episcopal Church, and the Nineteenth Century Club.
  - Also used to cross-check Pleasant Home, the Hemingway Birthplace architect (Wesley A. Arnold), and Cheney Mansion.
  - The direct download returns "Access Denied" to curl. It was retrieved through a web fetch tool.
- **Pleasant Home:** https://en.wikipedia.org/wiki/Pleasant_Home. NHL 1996.
- **Hemingway Birthplace:** https://en.wikipedia.org/wiki/Birthplace_of_Ernest_Hemingway
- **Hemingway Boyhood Home:** https://www.oakpark.com/2015/08/04/boyhood-home-gets-a-new-lease-on-life/ (architect Henry Fiddelke, 1906; Ernest lived there 1906-18; address 600 N. Kenilworth). Also https://www.oakpark.com/2012/02/28/hemingways-boyhood-home-hits-the-market-in-oak-park/
- **Scoville Square:** https://en.wikipedia.org/wiki/Scoville_Square
- **E.E. Roberts and John S. Van Bergen background:** https://en.wikipedia.org/wiki/Eben_Ezra_Roberts and https://en.wikipedia.org/wiki/John_S._Van_Bergen

### Place-level uncertainty and notes

- **What `year` means.** For buildings, `year` is the date given by the cited source. For parks, it is the year the Park District acquired the land: Scoville 1912, Rehm 1913, Taylor 1914, Field 1916, Mills 1939. It is null where no clear date exists.
- **Unity Temple:** the FLW Trust gives 1905-08; the Village landmarks list gives 1906-09. The file uses 1905, the commission year.
- **Thomas Gale House:** the FLW Trust gives 1892; the Village list gives 1893. The file uses 1892.
- **Hills-DeCaro House:** the FLW Trust gives a 1900 remodel; the Village list gives "1906/1977". `year` is null.
- **Flitcraft House:** the Village list gives "c. 1914".
- **FLW Home and Studio:** the FLW Trust "Home" page lists the address as 333 Forest Ave. That is wrong: the Home is at 428 Forest Ave, per the Village list and Wikipedia. The file uses the Studio and visitor address, 951 Chicago Ave.
- **Hemingway Boyhood Home:** a private residence, sold by the Hemingway Foundation in 2012. Players should view it from the street only. Most FLW houses here are also private (Trust "Accessibility: Private").
- **Mills Park and Pleasant Home** share 217 Home Ave. The park point and the house point are about 25 m apart.
- **Scoville Park** also holds the replica of Wright's Horse Show Fountain. It is covered in trivia, not added as a separate place.

## Trivia (trivia.json)

- Every question cites one of the sources above in `sourceUrl`.
- Village history facts come from https://en.wikipedia.org/wiki/Oak_Park,_Illinois: Kettlestrings 1835, 1968 fair housing ordinance, and Julian Middle School formerly Nathaniel Hawthorne Middle School.
- The village incorporation year was deliberately **left out**. Wikipedia's Oak Park article says 1902, while its FLW Historic District article says 1901.
- Choice order was shuffled with a fixed seed. "Was this designed by Frank Lloyd Wright?" items keep "Yes, Frank Lloyd Wright" as the first choice.

## Extra trivia (merged into trivia.json, ids t01–t40)

All sources were retrieved on 2026-10-03.

- **t01** (people): https://en.wikipedia.org/wiki/Ray_Kroc (retrieved 2026-10-03). Birthplace from Wikipedia. Cross-checked with OPRF Tradition of Excellence, which lists Kroc as Class of 1920 and McDonald's founder. Kroc left high school at 15, so the questions do not call him a graduate.
- **t02** (people): https://www.oakpark.com/2022/01/04/betty-white-born-in-oak-park-a-century-ago-dies-at-99/ (retrieved 2026-10-03). Wednesday Journal and Wikipedia agree on the birth date and the Oak Park birthplace.
- **t03** (people): https://carolshieldsprizeforfiction.com/aboutcarolshields (retrieved 2026-10-03). Wikipedia and the OPRF Tradition of Excellence list (Class of 1953) agree.
- **t04** (people): https://www.ebsco.com/research-starters/dance/doris-humphrey (retrieved 2026-10-03). EBSCO Research Starters and Wikipedia agree on Oak Park and Oct. 17, 1895.
- **t05** (people): https://www.oakpark.com/2017/11/28/tarzan-authors-home-gets-landmark-nod/ (retrieved 2026-10-03). Oak Park River Forest Museum says Burroughs lived in Oak Park 1910-11 and 1914-19. The question uses only the WJ dates for the Augusta St. house (1914-17).
- **t06** (people): https://www.hemingwaybirthplace.com/hemingway-and-oak-park (retrieved 2026-10-03). Hemingway Foundation page. Kansas City Star also in the JFK Library timeline.
- **t07** (people): https://abc7chicago.com/post/bob-newhart-dies-94-longtime-publicist-says-legend/15068896/ (retrieved 2026-10-03). ABC7 Chicago. The WJ obituary confirms the Oak Park birth (West Suburban, Sept. 5, 1929) but does not mention accounting.
- **t08** (people): https://oprfmuseum.org/people/percy-julian (retrieved 2026-10-03). The museum page says he moved in 1950. The firebombing was left out on purpose to keep the tone light.
- **t09** (history): https://www.oak-park.us/Government/Information-and-Resources/About-the-Village (retrieved 2026-10-03). Village 'About' page (Jan. 25, 1902) and the museum's Brief History agree. trivia.json had skipped the incorporation year because two Wikipedia articles disagreed (1901 vs 1902). The official Village and museum sources both say 1902, and this question asks about the township rather than the year.
- **t10** (history): https://www.oakpark.com/2007/09/11/before-oak-park-there-was-kettlestrings-grove/ (retrieved 2026-10-03). WJ 2007. Wikipedia also lists 'Harlem' as an early name, so Harlem is not used as a wrong choice.
- **t11** (history): https://www.oakpark.com/2014/12/23/oak-park-explores-allowing-taverns-41-years-after-first-approving-liquor-sales/ (retrieved 2026-10-03). WJ 2014. Wikipedia also gives 1973 for restaurant liquor sales.
- **t12** (history): https://oprfmuseum.org/brief-history-oak-park (retrieved 2026-10-03). Museum Brief History. Also https://oprhc.org/2019/05/in-memoriam-of-bobbie-raymond/ (1976 award). Could not fetch the National Civic League's list of past winners.
- **t13** (history): https://oprfmuseum.org/brief-history-oak-park (retrieved 2026-10-03). Only one source (museum Brief History). It is primary-ish and nothing contradicts it.
- **t14** (history): https://www.oak-park.us/Government/Information-and-Resources/About-the-Village (retrieved 2026-10-03). The year the manager form was adopted is NOT asked: Wikipedia says 1951, other sources say 1952/1953.
- **t15** (transport): https://www.transitchicago.com/greenline/ (retrieved 2026-10-03). CTA Green Line page lists Harlem/Lake as the western terminal. Wikipedia places the station on the Oak Park/Forest Park line.
- **t16** (transport): https://www.oak-park.us/Government/Information-and-Resources/About-the-Village (retrieved 2026-10-03). The Village page lists '1 Metra commuter rail line (West Line)' and the Blue and Green CTA lines. Wikipedia confirms the line is UP-W. metra.com returned 403.
- **t17** (transport): https://interactive.wbez.org/curiouscity/eisenhower/ (retrieved 2026-10-03). WBEZ Curious City. Wikipedia gives the same date and calls it the 'Congress Street Expressway'.
- **t18** (transport): https://www.zip-codes.com/city/il-oak-park.asp (retrieved 2026-10-03). Not a primary source (USPS lookup not fetchable). Wikipedia also gives 60301-60304, and 60303 is a PO-box ZIP. 60305 = River Forest.
- **t19** (transport): https://www.oak-park.us/Government/Information-and-Resources/About-the-Village (retrieved 2026-10-03). Village says 4.7 sq mi and Wikipedia says 4.70. The Park District loosely says 'four and a half', so the wrong choices are kept far from 4.7.
- **t20** (transport): https://www.oak-park.us/Government/Information-and-Resources/About-the-Village (retrieved 2026-10-03). Village 'About' page figures.
- **t21** (schools): https://www.oakpark.com/2023/09/29/a-history-of-news-the-trapeze/ (retrieved 2026-10-03). Wikipedia's OPRF article also lists the Trapeze. The Tabula was the literary magazine/yearbook, so it is avoided as a wrong choice.
- **t22** (schools): https://www.oprfhs.org/activities/tradition-of-excellence/past-award-recipients (retrieved 2026-10-03). OPRF official Tradition of Excellence list.
- **t23** (schools): https://www.oprfhs.org/activities/tradition-of-excellence/past-award-recipients (retrieved 2026-10-03). OPRF official Tradition of Excellence list.
- **t24** (schools): https://www.op97.org/brooks/history (retrieved 2026-10-03). District 97 official Brooks history page.
- **t25** (schools): https://www.op97.org/about/history (retrieved 2026-10-03). District 97 official history page.
- **t26** (schools): https://www.oppl.org/about/history/maze-branch-library-history/ (retrieved 2026-10-03). OPPL official history page.
- **t27** (schools): https://www.oppl.org/about/history/dole-branch-library-history/ (retrieved 2026-10-03). OPPL official history page.
- **t28** (culture): https://oakparkfestival.com/project/about-us/ (retrieved 2026-10-03). Festival Theatre official page. The Park District history also says Austin Gardens and 'since 1975'. Wikipedia says it moved into Austin Gardens in 1976, so the question does not ask about the year it moved.
- **t29** (culture): https://www.oak-park.us/News-articles/Oak-Park-Farmers-Market-celebrating-50th-season (retrieved 2026-10-03). Village news release. The founding year is 1976 (50th season in 2025). Some searches suggest 1975, which is why the question does not ask the start year.
- **t30** (culture): https://www.oak-park.us/Community/Events-and-Activities/A-Day-in-Our-Village (retrieved 2026-10-03). Village page. The edition count is inconsistent (the Village calls 2024 the 52nd, the Chamber calls 2024 the 50th anniversary), so no year is asked.
- **t31** (culture): https://oprfmuseum.org/this-month-in-history/lake-theatre-opens-much-fanfare-leather (retrieved 2026-10-03). The museum page gives April 11, 1936. Cinema Treasures says April 9. The question asks only the year, which both sources give as 1936 (also in the museum's Brief History).
- **t32** (culture): https://www.oakpark.com/2021/03/29/treasure-of-oak-park-art-league-beats-covid-celebrates-its-100th/ (retrieved 2026-10-03). WJ 2021. Open House Chicago and Wikipedia agree (carriage house at 720 Chicago Ave, 1937). Wikipedia/OHC also say Doris Humphrey once had a dance studio there. That is not used because WJ does not confirm it.
- **t33** (culture): https://www.oakpark.com/2017/09/12/a-new-museum-200-years-in-the-telling/ (retrieved 2026-10-03). WJ 2017. A WebSearch summary of museum materials also says Cicero Fire House No. 2, 1898.
- **t34** (culture): https://www.oak-park.us/Community/Events-and-Activities/Juneteenth-Celebration (retrieved 2026-10-03). Village page for 2026. Avoids saying when the local celebration started; only the 2020 proclamation is cited.
- **t35** (nature): https://pdop.org/about/sustainability/ (retrieved 2026-10-03). Park District page. WJ 2015 confirms 'first in the state'.
- **t36** (nature): https://www.oakpark.com/2014/08/12/the-old-growth-oaks-we-hold-so-dear/ (retrieved 2026-10-03). WJ 2014, quoting the Heritage Oak Project.
- **t37** (nature): https://content.govdelivery.com/accounts/ILOAKPARK/bulletins/398e91c (retrieved 2026-10-03). Village Manager's report (GovDelivery, Apr. 2024). Year counts differ slightly (the 2014 newsletter says the 30th consecutive year, the 2023 report says the 40th), so no count is asked.
- **t38** (nature): https://oakparkconservatory.org/tours/ (retrieved 2026-10-03). The Conservatory's official site names the Mediterranean, Tropical and Desert rooms. Older sources (e.g. Wikipedia) call one a 'Fern' room. 'Alpine' is wrong under either naming.
- **t39** (nature): https://oprfmuseum.org/this-month-in-history/oak-park-conservatory-faces-wrecking-ball (retrieved 2026-10-03). Oak Park River Forest Museum 'This Month in History'. Wikipedia agrees (parking lot, 1970).
- **t40** (nature): https://oakparkconservatory.org/tours/ (retrieved 2026-10-03). Conservatory official site. WJ 2023 also says 'over 3,000 plants'.

### Skipped or reworded because sources conflicted or could not be verified

- **OPRF founding year:** Wikipedia gives both 1871 and 1873.
- **Year the village manager form was adopted:** 1951 vs 1952/1953.
- **Wonder Works founding year:** 1991 vs 1993. Its address (6445 W North Ave) was verified, but no question was written.
- **Official 'village tree':** no official designation was found.
- **Kathryn Hahn:** not used. Sources say she was born in Westchester, IL, not Oak Park.
- **Percy Julian as Oak Park's 'first Black residents':** commonly repeated but historically contested, so not used.
- **A Day in Our Village start year, Farmers' Market start year, and Tree City USA year count:** inconsistent counts, so not asked.
- **The 1968 fair housing ordinance:** a fact the sources agree on, but already in trivia.json (q39), so not repeated.
