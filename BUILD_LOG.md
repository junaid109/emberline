# EMBERLINE — Build Log

A running record of how this prototype was built. Per the competition requirements, this log
records the decisions locked and what happened each session, and demonstrates that the prototype
was prompt-built with AI tools.

**Genre:** Survival & Resource Management
**Primary AI tool:** Claude Code (Claude Opus 5)
**Supporting AI tools:** Gemini image generation (build-time asset generation only)

---

## Format of each entry

- **Date / session**
- **Decisions locked** — what was settled and will not be revisited
- **Prompted** — what was asked of the AI tool
- **Result** — what the AI produced, and whether it worked first time
- **Hand edits** — any manual code changes, and why
- **Verified** — how the result was tested
- **Open / next**

---

## Session 001 — 2026-08-21 — Research, scoping, and design lock

### Decisions locked

1. **Genre: Survival & Resource Management.** One entry per person is permitted, so this is final.
2. **Session shape: day/night survival cycle**, 7 nights, approximately 10 minutes total. Chosen over
   a single rising-storm clock and an expedition push-your-luck structure because it delivers
   escalation *within a single session*, which the official design guidance explicitly requires.
3. **Signature mechanic: the furnace is the map.** Heat is rendered as a literal radius of thawed
   ground rather than a bar. Feeding the furnace expands the playable world; letting it dim makes
   snow creep inward and reclaim built structures.
4. **Four resources — wood, meat, water, stone —** deliberately non-interchangeable. Each is bought
   with a different cost: time, risk, heat, and opportunity respectively. Water is melted at the
   furnace, so gathering it consumes the fuel keeping the player alive.
5. **Night role: rally taps.** Combat is fully automatic. The player repositions a single guard
   squad between three gates while continuing to haul fuel. No manual aiming or attacking.
6. **Adopted from outside the genre:** tycoon-style ghost-build plots, and walk-in upgrade pads that
   remove menus from the game entirely.
7. **Deferred:** dawn draft of 1-of-3 buffs. Revisit only if ahead of schedule at day 11.
8. **Audio: WebAudio-synthesised SFX only.** No audio files. ElevenLabs dropped to protect zip size
   and remove a dependency. Story delivered as text.
9. **Assets: procedural low-poly geometry written in code.** No model files in committed scope.
   Rationale: the official guidance states visual polish is not scored, only legibility, and model
   files threaten both the 35MB cap and the no-network requirement.

### Prompted

- Asked the AI to fetch and analyse the competition rules page, design-guidance page, and overview,
  and to extract binding constraints rather than summarise marketing copy.
- Asked it to brainstorm the core loop against the published judging weights, and to push back where
  the initial concept conflicted with the rules.
- Asked it to check specifically whether generative AI assets are permitted, and whether a source
  repository is required.

### Result

Extracted the binding constraints: 35MB zip, `index.html` at zip top level, unminified game code,
third-party libraries confined to a `vendor/` folder, all assets local with relative paths, zero
external network requests at runtime, portrait orientation, single-player.

Judging weights confirmed as Player Engagement 30%, Playability 25%, Core Loop Design 20%,
Focus 15%, Originality 10%. Visual polish is explicitly not scored.

The AI pushed back on two points in the original concept, and both pushbacks were adopted:

- Heavy investment in generated 3D assets is low return, since polish is unscored and asset files
  compete for the 35MB budget.
- The reference game's real progression is multi-session and meta; the rules require escalation
  *within* a session, so the design was restructured around a 7-night arc.

Confirmed that AI use is mandatory, not merely permitted: the prototype must be prompt-built and
accompanied by this log. Confirmed no source repository is required, public or private.

### Hand edits

None — no game code written this session.

### Verified

Rules and design guidance read directly from the competition site rather than from memory. Deadline
confirmed as 2026-09-08, 1:00 PM PDT. Eligibility confirmed by the entrant (MHCP membership
predates 2026-08-10).

### Open / next

- Design spec written to `docs/superpowers/specs/2026-08-21-emberline-design.md`.
- Repository initialised locally.
- Awaiting: official Build Log guidance PDF (Drive link is sign-in gated) to align this format.
- Test devices confirmed: **both Android and iPhone**. Android is the primary debug device via
  Chrome remote debugging over USB. iPhone is a late-schedule compatibility pass. Known iOS Safari
  risks to code defensively against from day 1: WebAudio unlock requiring a first user gesture, the
  `100vh` viewport bug, and `touch-action` scroll interception on the joystick.
- Next session: implementation plan, then the day 1–2 playable slice (joystick, terrain, resource
  nodes, carry-stack, furnace deposit, heat ring).

---

## Session 002 — 2026-08-21 — Playable slice: joystick, harvest, carry stack, furnace, heat ring

Executed the day 1–2 milestone plan as six tasks. Each task was implemented by a fresh AI agent
working from an extracted task brief, then reviewed by a separate AI agent against the spec and the
competition's binding constraints, with fixes dispatched and re-reviewed until clean. A final
whole-branch review followed. 13 commits.

### Decisions locked

1. **Architecture: pure logic separated from rendering.** `src/core/` contains no Three.js reference
   at all and is unit-testable headlessly with `node --test`; `src/render/`, `src/input/`, and
   `src/ui/` consume it. The dependency direction points one way only. This is what makes the
   economy, heat model, and deposit cadence testable, and those are exactly the parts that the
   tuning pass will need to change safely.
2. **Three.js is bundled to an IIFE global, not an ES module.** The rules say to test from a local
   server, but if a judge opens `index.html` directly, an import map fails on `file://` and they see
   a black screen. A plain `<script src="./vendor/three.js">` works either way. Our own game code
   still ships fully readable and unminified as the rules require.
3. **Packaging is validated automatically, before any game code existed.** The competition has
   silent auto-fail conditions; `npm run package` refuses to emit a zip that violates them.
4. **Every tunable number lives in `src/core/constants.js`.** Days 12–14 are a tuning pass, and
   hunting magic numbers across ten files would waste that window.
5. **Camera reframed to a diorama view** so the heat ring is actually visible (see below).

### Prompted

- Asked for the packaging pipeline and its validator to be built first, before any gameplay.
- Asked for each task to be implemented test-first, and for the implementer to report anything it
  could not verify rather than marking it done.
- Asked reviewers to hand-verify the load-bearing maths with concrete numbers rather than reading
  for plausibility, and to state explicitly whether a test would pass against a broken implementation.
- Asked the final review for what only a whole-branch view reveals — cross-cutting interactions that
  per-task reviews structurally cannot see.

### Result

The core loop works end to end: joystick out to a tree, auto-harvest with logs visibly stacking on
the player's back, haul back, stand on the furnace pad, logs drain off one at a time, and the thawed
ring physically grows.

The AI did the heavy lifting throughout, and review caught real defects the implementers did not.
The most significant, all found by AI review rather than by hand:

- **The packaging validator was validating a fabricated file list.** It reconstructed the archive
  contents from the source tree with `index.html` hardcoded, so the "index.html must be at the zip's
  top level" check could never fail. Now reads the real archive entries.
- **The validator would have green-lit a game containing no Three.js.** `vendor/` is gitignored, and
  the packaging step dropped missing paths silently. Now checks vendor presence, relative
  referencing, and that the library has not been accidentally inlined into `index.html`.
- **The safe-area insets silently did nothing.** The overlay used `padding`, but the containing
  block for an absolutely positioned child is the *padding box* — so the HUD sat at 12px from the
  viewport edge, inside the iPhone Dynamic Island. Changed to `inset`.
- **The renderer took its aspect ratio and its display size from two different viewports**, so the
  scene stretched non-uniformly whenever the mobile URL bar was showing.
- **The joystick activated across the whole left 60% of the screen**, not the lower-left, because the
  gate had no vertical condition. It would have swallowed the rally taps planned for the next
  milestone.
- **The heat ring was wider than the camera could show.** A portrait camera specified by *vertical*
  FOV has its horizontal frame crushed by the aspect ratio: 21.6° horizontal, about 12.5 world units,
  against a ring 31–44 units across. The player would never have perceived a ring at all — the
  signature mechanic, invisible. Fixed by deriving vertical FOV from a target horizontal width,
  recomputed on resize so aspect can never crush it again. Now 52 world units visible; the full ring
  fits with margin.
- **The heat-ring rim was a fixed ratio of the radius**, so it was thinnest exactly at low heat when
  the player most needs to read it. Now a constant world-space band.

### Hand edits

Minimal, and each is recorded with its cause:

- `node --test tests/` fails on Node v26 / Windows, so the test script uses an explicit glob. Node's
  directory mode was re-investigated later and genuinely still fails here, so the glob stayed.
- `tools/package.mjs`'s main-guard compared `import.meta.url` against a string-concatenated file URL,
  which never matches on Windows (a file URL needs three slashes before the drive letter). This
  silently made `npm run package` a no-op. Fixed with `pathToFileURL`.
- That same guard then threw on import wherever `process.argv[1]` is undefined. Found during final
  verification, guarded, and covered by a regression test.

### Verified

- 73 tests passing via `node --test`.
- `npm run package` emits `emberline.zip` at 0.29MB against the 35MB cap.
- Archive entries confirmed programmatically as exactly `index.html` and `vendor/three.js`, with
  `index.html` at the top level.
- `index.html` contains no `http://` or `https://` reference; 531 lines, longest line 154 characters,
  unminified and readable.
- Device pixel ratio confirmed capped at 2 (393x852 CSS produced a 786x1704 backing buffer).
- Regression tests were validated by mutation: the deposit tests were checked against three
  deliberately broken variants (instant-dump, missing timer reset, flipped pad condition) and each
  mutant failed the suite before being reverted.

### Open / next

- **Not yet verified on physical hardware.** Every device check is outstanding on the Galaxy S24
  Ultra and iPhone 16. Playability is 25% of the score, so this is the top priority.
- **`src/core/world.js` was specified in the plan and never built.** All world state and system
  ordering currently live in `src/main.js`'s frame loop, which has no automated coverage. The next
  five milestones add day/night phases, gates, wolves, and win/lose on top of it. Extract before
  Milestone 2, while the frame loop is still small.
- Build Log guidance PDF still not readable (the Drive link requires sign-in); this format follows
  the Devpost description and should be reconciled against the official template.
- Next: Milestone 2 — day/night cycle, dusk telegraph, three gates, wolves, guard squad, rally taps.
