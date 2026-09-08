# What do our commissions do?

**The question:** Oak Park has dozens of citizen commissions. What does each one actually do, how often do they meet, and how would a resident find the one that matches their interests?

**Why it matters:** Commissions are the front door to local government (this event is run by one), and most residents can't name three. A "find your commission" tool is genuinely missing.

## The data

- `commissions-diod.csv`, right here in this repo: every commission with description, meeting schedule, and links
- Granicus meeting video archive (agendas, minutes, recordings): linked per commission from the Village site
- Village board/commission pages on oak-park.us

## First win (15 minutes)

Load the CSV and answer one question: which commissions meet most often? Which haven't met lately?

## The build (by 2:15)

A "find your commission" mini-site or quiz: pick your interests (housing, environment, safety, tech...), get your commission, its next meeting, and how to join. A static page or even a well-organized spreadsheet-turned-flyer demos fine.

## Stretch

Use Claude to summarize a few recent meeting agendas/minutes per commission into "what they've actually worked on this year", this is the best LLM showcase in the room.

## No-code roles

- Read agendas and write the one-paragraph "what this commission really does" blurbs
- Design the quiz questions that map interests to commissions
- Anyone who has attended a commission meeting: add the "what it's like to show up" field

## Claude tips

Paste an agenda PDF's text and ask for a 3-sentence plain-language summary. Ask Claude to build the interest-matching quiz as a single HTML page from your CSV.
