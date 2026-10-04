# Survivor: Oak Park

A Survivor-style game set in Oak Park, IL. Tribes are local schools and the castaways are a random draw of Oak Park's elected officials. You play as one of them.

- **Setup:** pick 2–4 D97/OPRF schools as tribes (on the list or the map), choose a season size (Short, Classic, Long or Custom), and pick your castaway.
- **Camp:** two moves per episode: talk, propose an alliance, hunt for the hidden idol at spots near camp, or rest.
- **Challenges:** they rotate between a simulated endurance relay at a park, **Higher or Lower** using real 2025 Cook County assessed values (both homes are pinned on the map, and the answer shows the Assessor's photos), and Oak Park landmark trivia ("Was this designed by Frank Lloyd Wright?"). Winners get an idol hint that narrows the search on the map. After the data and trivia challenges, a card explains the answers and links to the Assessor so you can look up your own home.
- **Tribal Council:** held at Village Hall Council Chambers, with idols, an Extra Vote, Steal-a-Vote and Shot in the Dark. The tribes merge mid-season, and everyone voted out after that joins the jury, which picks the Sole Survivor. A tied jury is settled by bonus points for achievements: Immunity champ, Team player, Least voted, Idol hunter and Jury favorite.
- The game saves in the browser. The share button copies a link that recreates the same season setup.

Data and sources: `public/data/SOURCES.md`.

## Develop

```sh
npm install
npm run dev        # http://127.0.0.1:5173
npm run check      # Biome lint/format
npm run build      # type-check + production build
npm run simulate   # play 300 headless seasons and check invariants
```
