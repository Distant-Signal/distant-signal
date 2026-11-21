# Screen reader manual test

**For a person with a real screen reader.** The automated checks (axe in
`frontend/e2e/accessibility.spec.ts`, the accessibility-tree snapshots in
`frontend/e2e/screen-reader-tree.spec.ts`, the keyboard journey in
`frontend/e2e/keyboard-journey.spec.ts`) test names, roles, structure and
focus in a browser. None of them speaks, and none of them is a screen reader:
what is said, in what order and how it sounds can only be judged by listening.
Run this before a release that changes how a page is built, and after the
first screen reader fixes of a new area. About 30 minutes.

Nobody on the project has run it yet with each reader below. A "pass" in this
file is only ever a person's, with their reader, version and date in the
record at the end.

## What to run it with

| Reader | Browser | System | Notes |
|---|---|---|---|
| NVDA | Firefox | Windows | The reference run. |
| NVDA | Chrome | Windows | Same keys; differences are usually the browser's. |
| VoiceOver | Safari | macOS | Quick Nav off; use the rotor (VO+U). |
| VoiceOver | Safari | iOS | Swipe to move, double tap to activate, rotor by twisting two fingers. |
| TalkBack | Chrome | Android | Swipe to move, double tap to activate, reading controls from the local context menu. |

Keys used below (desktop):

| Task | NVDA | VoiceOver (macOS) |
|---|---|---|
| Next or previous heading | H or Shift+H | VO+Command+H, or the rotor |
| List of headings, landmarks, links, buttons | Insert+F7 | VO+U, then arrow |
| Next form field | F | Rotor, Form Controls |
| Next table, next list | T, L | Rotor, Tables, Lists |
| Read a table cell with its headers | Ctrl+Alt+arrows | VO+arrows inside the table |
| Activate | Enter or Space | VO+Space |
| Stop speech | Ctrl | Ctrl |

## Setup

- Browser at 100% zoom, speech rate you can follow, NVDA punctuation level
  "some". Do not use a high-contrast or reduced-motion mode for the first pass.
- An account on a stack with at least: one tracked train, one planned journey,
  a journey with several legs (a walk between two trains and a leg with no train
  picked yet), a journey shared into a group, and a train that is running late.
  The seeded e2e stack (`frontend/e2e/fixtures/seed.sql`) has all of these; so
  does a staging account.
- Start on the home page, signed in. Keep the page open for step 15.

How to read "Expect": it is what the accessibility tree says today. Different
wording is fine. A missing fact, an unlabelled control, a repeated name that does
not say which one it is, a lost focus or something announced that you did not
ask for is a bug: write down the step number and what you heard.

## A. Page chrome (desktop pairs)

1. Load `/`. Press Tab once.
   Expect: "Skip to content, link". Press Enter, then Tab: the next stop is in the
   page content (its first link), not in the header again.
2. Open the landmarks list.
   Expect: navigation "Main", main, contentinfo, navigation "Site information".
   Each name is different.
3. Open the headings list.
   Expect: one heading level 1, then level 2 sections; no skipped level.
4. Activate the "Lines" link in the header.
   Expect: the new page's title is spoken (a page change announcement). Press H:
   you reach the level 1 heading in one key press.
5. Tab to "Data freshness".
   Expect: its description is read with it (per-source times, such as "13 min ago").

## B. Menus (phones first, then desktop)

6. Phone: swipe to "Navigation menu, button, collapsed" and double tap.
   Expect: a dialog named "Menu" and focus on "Close". Swiping never reaches the
   page behind it. Close it: focus returns to "Navigation menu".
7. Signed in: open the account menu button (its name includes your initials).
   Expect: a menu with Groups, Account and data, Preferences, Log out. Escape
   closes it and focus returns to the button.

## C. A train page, `/train/<uid>/<date>`

8. Open a train you track.
   Expect: heading level 1 such as "10:00 London Kings Cross to Edinburgh", then
   status text ("Delay: 4 min late", "Next calling point: ...").
9. Move to the table "Journey timeline" (T).
   Expect: "table, Journey timeline", column headers Station, Scheduled, Actual,
   Delay, Platform. Moving through cells reads a header with each: "09:00",
   "estimated 09:04" (or "est. 09:04": say which you heard), "4 min late". A
   changed platform reads "Platform 9 (changed from 6)" once, not twice.
10. Activate "Detailed (working timetable)".
    Expect: "expanded", then a named table "Working timetable" with its own
    column headers.
11. Delays and cancellations.
    Expect: every status is words ("Cancelled", "4 min late"), never only a colour.

## D. Live updates (the 30-second refresh)

12. Stay on a train page of a running train for two minutes, reading the delay line.
    Expect: nothing is announced by itself, focus does not move and the page does
    not scroll. A changed delay is in the page the next time you read it. This is
    the design (`e2e/screen-reader-dynamic.spec.ts` documents it). Decide whether
    you would want to be told, and write it down: that is a product question, not
    a failure.
13. Switch to another tab for a minute and come back.
    Expect: one silent refresh; nothing re-read.
14. Turn the network off.
    Expect: a polite announcement along the lines of "Can't reach live data right
    now. Showing the update from HH:MM."

## E. Journeys

15. `/journeys`: move to the lists (L).
    Expect: "list, Upcoming journeys" and "list, Past journeys", each with N items.
    Moving through an item reads the name link, the status ("Planned", "Completed
    5 min late"), "From <group>" and "Shared by <person>". On a journey shared with
    you, the button reads "Follow this journey: <that journey's name>", so two rows
    do not both say only "Follow this journey". Unfollow reads the same way.
16. Open a journey with a walk between two trains.
    Expect: heading level 1 with the journey's name. Each leg starts with a text
    "Leg 1 of 3". The walk is a button "Walk to <place>, 5 min", collapsed; activate
    it and it says "expanded", focus stays on it, and Tab goes to "Edit leg: Walk".
    The walk is not counted in "Leg N of M".
17. On a journey with several legs, list the buttons (the buttons list).
    Expect: no two have the same name. "Change train for leg 1: <route>",
    "Remove leg 1: <route>", "Add ticket details for leg 1: <route>", the switch
    "Notify me about this train for leg 1: <route>", and the same
    for leg 2; for the leg with no train picked, "Edit search for leg 3: <route>"
    and "Remove leg 3: <route>". The number is the one in "Leg N of M". Each name
    starts with the button's visible words.
18. Activate "Change train for leg 1".
    Expect: the button now reads "Cancel changing train for leg 1: <route>". A search
    summary ("Other trains: ...", "Departing at or after ..."), then lists: "Earlier
    trains" and "Trains in your search" (or "Candidate trains" when no train is
    earlier). Each row reads time, destination, the train and, on the train the leg
    is on, "Current train". Cancel puts you back on "Change train for leg 1".
19. "I missed this train" (or "Find another way"): activate it, then press Escape.
    Expect: the dialog is announced with a name; Escape closes it and focus is back on
    the button you used.
20. "Delete journey".
    Expect: dialog "Delete this journey?"; Escape or Cancel returns focus to "Delete
    journey". Confirm: after the page changes you hear "Journey deleted" and an "Undo"
    button; Tab reaches Undo, Enter restores it.

## F. Planner and forms

21. `/plan`: the radio group "How do you want to start this journey?" with three options.
    Expect: changing it announces which form is showing ("Showing the plan-a-route-for-me
    form").
22. Field "From": type "KGX".
    Expect: "combobox, expanded" with suggestions. Down Arrow reads the first one
    ("London Kings Cross (KGX)", with its position if your reader says it); Enter sets
    the field and keeps focus in it. Write down whether the number of suggestions is
    spoken as you type (it is not announced today).
23. `/plan?mode=known`, the departure date and time.
    Expect: a button with its hint (the allowed range), a dialog with a calendar on
    activation, and Escape back to the button.
24. A disabled button ("Find routes" before both stations are filled in).
    Expect: "dimmed" or "unavailable". Write down whether you can tell what is missing.
25. Find routes, Tab to a route, Space to pick it, then "Track this journey".
    Expect: "First leg tracked" is spoken as an alert without moving focus; Tab goes to
    "View journey".

## G. Lines and stations

26. `/lines`: the table of lines.
    Expect: sortable column headers say which one is sorted ("sorted ascending"). Each Pin
    button's name says which line it belongs to.
27. `/stations/KGX`: open the "Accessibility and facilities" disclosures.
    Expect: heading levels nest (3 under 2, 4 under 3) and each disclosure says expanded
    or collapsed.

## H. Chat (`/chat`, signed in)

28. Ask "next train from KGX to PBO".
    Expect: you are told an answer is coming and when it has arrived; focus is not thrown
    to the start of the page after Send.
29. When the assistant asks "Allow this action?":
    Expect: it is announced, and Allow and "Don't allow" are reachable without
    crossing the whole transcript.

## Record

For each reader: reader and version, browser and version, system, date, your name. For each
failed step: the step number, what you heard, what you expected. File one issue per failed
step, titled "Screen reader: step N, <reader>". Add a line to this file's history only for a
change to the script itself.
