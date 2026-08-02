# Homepage Contract

The homepage makes the problem legible before introducing the wider product
architecture. Its reading order is claim, proof, explanation, and navigation.

## Pain-to-Proof Reel

The page opens directly below the shared header with one full-width, two-slide
reel in a 16:9 frame:

1. Slide 1 names the human burden of carrying context between Agents. Its
   supporting copy makes the economic consequence explicit: use the best Agent
   where it matters and a cheaper one where it does not, without replacing the
   Work.
2. Slide 2 replays the exact Agent Work Lab proof. The replay demonstrates
   continuity across Agents; it does not independently prove provider support,
   durability, release status, or Production qualification.

After five seconds, the reel cross-fades once from the pain claim to the proof.
The explicit proof action performs the same transition immediately. A click,
arrow-key action, or touch swipe permanently cancels automatic progression for
that page visit. Reduced-motion visitors receive no automatic transition and
retain manual previous and next controls.

The Pain to Proof label, visible slide counter, and controls share one overlay
in the card's bottom-right corner. The accessible live status retains the full
slide title. The caption reserves a stable safety gap before the overlay and
keeps supporting links visually separate from the controls. Do not add a
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

The supporting row places the three-line brand principle on the left, the
execution-surface explanation in the center as a left-aligned text block, and
the Agent-native loop plus Agent Builders links as two right-aligned rows.
Installation remains the single primary action in the shared header.

Do not restore the retired static continuity comparison card. It duplicated
the Agent Work Lab replay and weakened the primary demonstration path.

## Auditable Media

`scripts/import-auditable-demo.mjs` generates the Agent Work Lab poster,
transcript, duration, public evidence path, and responsive media bindings from
the retained Passport and closed media bundle.

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
appear on `/how-tested/auditable-demo/`, including the Project Tour at 0.8x,
and `homepageDemoId` may select one for the reel without replacing the Agent
Work Lab compatibility projection.

Demo identity selects presentation only and grants no publication or runtime
authority. Every projection retains the selected media profile, qualification
root, and exact role-to-file coordinates.
