# Homepage Contract

The homepage makes the problem legible before introducing the wider product
architecture. Its reading order is claim, proof, explanation, and navigation.

## Pain-to-Proof Reel

The page opens directly below the shared header with a compact evidence and
installation row, followed by one full-width reel in a 16:9 frame. The reel has
four semantic chapters:

1. Problem names the human burden of carrying context between Agents. Its
   supporting copy makes the economic consequence explicit: use the best Agent
   where it matters and a cheaper one where it does not, without replacing the
   Work.
2. Continuity asks whether Work can survive a new Agent and binds the compact
   Agent Work Lab proof.
3. Failure retention asks whether Work can survive failure and binds Project
   Tour episode 1.
4. Review and settlement asks who may complete Work and binds Project Tour
   episode 2.

The three proof labels, questions, summaries, transitions, and demo order come
from the exact, SHA-256-bound Kungfu
`buildchain.declarative-demo-presentation/v1` contract snapshot. The importer
verifies the complete source contract bytes and binds every proof to an imported
demo, Passport, and media root. Homepage code owns only layout, timing, and
interaction; it does not own a second copy of the product narrative.

Each proof chapter has two internal states, prelude and animation. Those states
do not change semantic chapter progress. Direct chapter navigation always lands
on the requested prelude. After five seconds, the reel may move from Problem to
the Continuity prelude, then start only the compact Continuity animation after
a short reading interval. Project Tour episodes 1 and 2 always require an
explicit start. Any click, chapter navigation, arrow-key action, touch swipe, or
media interaction permanently cancels queued automatic progression for that
page visit.

All proof videos are non-looping. Only the active proof may play; leaving a
chapter pauses and resets its media. Inactive media uses `preload="none"`, and
only an active animation may advance to metadata loading. Reduced-motion
visitors receive no timed chapter or animation transition and retain complete
manual chapter, previous, next, play or pause, skip, and native media controls.

The built homepage must import the proof-reel state module through its exact
content-fingerprinted `/assets/proof-reel-state.<hash>.js` URL. The unversioned
file is only a build input. Production may cache ordinary assets longer than
mutable HTML, so an unversioned module URL could otherwise pair new HTML imports
with stale exports and disable the complete interaction surface.

The Problem to Three proofs label, stable proof counter, direct chapter tabs,
and playback controls share one overlay in the card's bottom-right corner. The
accessible live status retains the full chapter title and internal state. The
caption reserves a stable safety gap before the overlay and keeps transcript,
evidence, and Passport links visually separate from the controls. Do not add a
second controls row or change the reel geometry.

## Layout

The showcase owns the single border, background, and shadow; individual slides
do not draw nested cards. In the light theme, the container uses the site's cool
gray-blue surface while the video keeps its natural dark field.

On desktop, the reel is constrained by both available page width and dynamic
viewport height. The height calculation reserves the shared header, card
chrome, and a small bottom margin so the complete card remains visible without
scrolling, including on scaled 4K displays and browser viewports with reduced
CSS-pixel height. Claim typography uses carousel container units so it shrinks
with the frame instead of overflowing.

One compact acquisition row above the reel keeps the public dogfood proof and
installation path together within the first desktop viewport. The proof names
the stable featured 30-day public PR observation and its ending date, and links
to the canonical `libkungfu.dev/dogfood/` evidence page where that observation
is the reader default. It must not present the featured value as the latest
rolling observation. Its adjacent installation card
names the public Alpha boundary, desktop plus standalone CLI surfaces, and
macOS, Linux, and Windows availability, then hands off to the canonical
`/install/` route for exact platform and architecture details. The shared-header
button remains the primary navigation action; this row is the intentional
first-screen conversion path, not a second evidence or download authority.

Below the reel, the supporting row places the three-line brand principle on the
left, the execution-surface explanation in the center as a left-aligned text
block, and the Agent-native loop plus Agent Builders links as two right-aligned
rows.

Do not restore the retired static continuity comparison card. It duplicated
the Agent Work Lab replay and weakened the primary demonstration path.

## Auditable Media

`scripts/import-auditable-demo.mjs` generates all three proof chapters, posters,
transcripts, durations, public evidence paths, Passport links, and responsive
media bindings from the retained Passports, closed media bundles, and exact
presentation contract snapshot.

The qualified evidence supplies native 1920x1080 MP4/WebM for desktop and
independently captured native 1280x720 MP4/WebM for constrained screens.
`<source media>` selection is derived from qualified rendition roles, never
inferred from file names. The importer verifies that the two frame sets have
different capture roots and that every video was encoded from its declared
native frame set. The 720p GIF remains the README compatibility rendition.
Only the active slide may play; playback remains muted and user-controllable
and falls back to the exact poster when blocked by the browser.

The importer accepts:

- `kungfu.site.auditable-demo-source/v1` for the current single source.
- `kungfu.site.auditable-demo-source/v2` for a collection with one featured
  demo, an optional independent homepage demo, and one to eight exact
  `demo id -> Passport + media directory` bindings.
- `kungfu.site.auditable-demo-source/v3` for Buildchain's declarative
  standalone-binary evidence directories. Each entry binds one demo id,
  display command, site slug, generic Release Passport, long-form duration
  policy when declared, and two independent native capture roots.

Each collection entry is independently verified and materialized under its
Passport root. `/auditable-demo.json` remains the featured compatibility
projection; `/auditable-demos.json` and
`/auditable-demos/<demo-id>.json` expose the collection. Additional videos may
appear on `/how-tested/auditable-demo/`. A v3 source may bind a presentation
contract, in which case its ordered proofs replace the legacy single
`homepageDemoId` projection without replacing the Agent Work Lab compatibility
route.

Demo identity selects presentation only and grants no publication or runtime
authority. Every projection retains the selected media profile, qualification
root, and exact role-to-file coordinates.
