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

---

## Session 003 — 2026-08-23 — World extraction, and the bugs only a screenshot could find

Extracted the simulation out of the render loop, then ran the game in a real browser at phone
viewport size for the first time. The browser pass found three defects that 113 passing tests had
no way to see.

### Decisions locked

1. **`src/core/world.js` owns all state AND system ordering.** The previous milestone left both in
   the frame loop, where nothing could test them. `tickWorld(world, dt, dirX, dirZ)` now runs move
   to drain to harvest to deposit and returns a reused events object; `src/main.js` is reduced to
   copying numbers onto meshes and owns no game rules at all.
2. **Every depth-dependent camera setting is derived, never hand-picked.** Fog bounds and the far
   clip plane are computed from `CAMERA_HEIGHT`/`CAMERA_DISTANCE`/`WORLD_RADIUS` in
   `constants.js`, so moving the camera can no longer leave them behind at stale values.
3. **Visual ground extent is separate from walkable extent.** `GROUND_VISUAL_RADIUS` (220) is what
   is drawn; `WORLD_RADIUS` (34) is what bounds the player.
4. **The frame-time clamp is a named, tested constant.** `MAX_FRAME_DT` is load-bearing — it is
   what makes `tickHarvest` and `tickDeposit` provably bounded — so it is asserted against
   `HARVEST_SECONDS` rather than left as a literal in the loop.

### Prompted

- Asked for the world extraction to be done test-first, with the system ORDER pinned by a test
  rather than by a comment, since ordering was the specific thing that had no coverage.
- Asked for the running game to be opened at phone viewport size and inspected, rather than
  trusting a green test suite as evidence that it renders.

### Result

The extraction itself was clean: 31 new tests, including a full gather-haul-deposit round trip
driven entirely through the same joystick input the player uses.

Then the first browser screenshot came back as a flat grey rectangle, and the pass turned up three
defects in a row that no unit test could have caught:

- **The entire scene was fogged out.** The diorama camera sits ~88 world units from its target, but
  fog had been left at a hand-picked 40–80 range from before the camera was moved. Every object in
  the game was past `fog.far`, so the world rendered as one uniform grey field. Fog is now derived
  from the camera geometry and the bounds are asserted in tests.
- **The canvas was never full-screen.** `#game { position: fixed; inset: 0 }` looks like it fills
  the viewport, but a canvas is a **replaced element** — with `width: auto` it keeps its intrinsic
  size and ignores the inset box entirely. Since the renderer sizes its drawing buffer from
  `canvas.clientWidth`, this made the renderer feed its own output back in as input: the game ran in
  a 600x300 box in the corner of the screen, on every device. Fixed with explicit `width`/`height`,
  and the packaging validator now rejects a `#game` rule that lacks them.
- **The playfield read as a floating island.** The snow was drawn at the walkable radius, leaving a
  hard-edged ellipse with void above and below it. The snowfield now runs past the fog distance and
  dissolves into the horizon.

A fourth, smaller finding came from actually playing it: standing on the furnace did nothing,
because the deposit pad was drawn as a thin half-transparent ring that was invisible against the
thawed ground. Walk-in pads are this game's only interaction verb, so the pad is now a bright
filled disc with a solid rim. Both are sized from `PAD_RADIUS`, so what is drawn cannot drift from
what is tested.

### Hand edits

- The new packaging-validator rule initially failed seven existing tests, whose fixtures are HTML
  fragments with no canvas in them. Scoped the rule to documents that actually contain
  `<canvas id="game">` rather than weakening the check.
- Three test expectations were written assuming one tree fills the carry. It does not —
  `NODE_AMOUNT` (6) is deliberately below `CARRY_CAP` (8). Corrected the tests and added an explicit
  assertion pinning that relationship, since it is a tuning decision worth protecting.

### Verified

- 114 tests passing.
- `npm run package` emits `emberline.zip` at 0.29MB.
- Played in-browser at a 375x812 portrait viewport: canvas confirmed at 375x812 CSS with a 750x1624
  backing buffer (DPR capped at 2 as intended), no console errors.
- Full loop confirmed on screen: walked out, auto-harvested a tree to depletion (its mesh
  disappeared), hauled back, stepped onto the pad, and watched wood go 0 to 6 while heat went 0% to
  34% and the ring visibly grew.
- The new validator rule was mutation-checked: it rejects the old `inset: 0`-only CSS and accepts
  the fixed rule.

### Open / next

- **Still not verified on physical hardware.** Everything above was a desktop browser at phone
  dimensions, which cannot tell us about thumb reach, real DPR, or sustained framerate.
- **`PAD_RADIUS` (3.2) may be too tight.** Approaching the furnace, it was easy to stand somewhere
  that looked correct and be outside it. Deliberately left for the tuning pass rather than changed
  on a hunch, but it needs a real thumb on a real phone to judge.
- **Heat drains a full bar in about 37 seconds**, so the furnace dies before a round trip completes.
  That is expected — the day/night cycle that gives this pressure its shape is the next milestone.
- Next: Milestone 2 — day/night cycle, dusk telegraph, three gates, wolves, guard squad, rally taps.

---

## Session 004 — 2026-08-25 — Milestone 2: the night

The day loop now has something to be *for*. Seven nights, a dusk telegraph, three
gates, wolves, and one guard squad moved by tapping.

### Decisions locked

1. **The telegraph is a promise, not a hint.** The gates a night will use are rolled once at
   dusk and are exactly the gates wolves spawn from. If those could ever diverge, the rally
   decision would be a coin flip and the dusk window would be decoration. This is enforced by
   test, and the test was mutation-checked.
2. **Squad damage is split across every wolf in range, not focused.** Focusing would let one
   squad hold any gate forever. Splitting means a big enough pack overwhelms them, which is
   what keeps the player hauling instead of parking the squad and watching.
3. **Rallying costs travel time.** The squad walks; it does not teleport. That travel is the
   entire price of a wrong guess, and it is the only price — so it has to be real.
4. **Night lighting is floored, never black.** Legibility is the one visual property the
   competition scores. A player who cannot see the wolf eating their furnace has been given
   atmosphere instead of information.
5. **Input is split by screen region, not by gesture.** The joystick owns the lower-left; taps
   own everything else. The two regions are asserted to tile the screen exactly — no overlap,
   no dead zone — so the controls can never fight over a pointer.
6. **The randomness source is injected.** `createWorld(roll)` takes the RNG, so the telegraph
   is reproducible under test and can be asserted against the wolves that actually spawn.

### Prompted

- Asked for the night to be built core-first, with the phase machine, gates, wolves and squad
  as pure modules that know nothing about rendering.
- Asked specifically for tests that would fail if playing well and playing badly produced the
  same outcome — the failure mode that makes a decision cosmetic.
- Asked for the render layer to get smoke coverage, since the browser was unavailable this
  session and shipping it unverified was not acceptable.

### Result

168 core tests, then 20 more for the render/input layer. The two that matter most are a
matched pair: rally to the lit gate and the furnace is never touched; rally to the wrong one
and it is mauled. Together they prove the night contains an actual decision.

Both were mutation-checked rather than trusted:

- Making wolves spawn at any gate regardless of the telegraph failed *the tell must never lie*
  and *a correctly rallied squad clears the night*.
- Making the squad teleport instead of walk failed *rallying costs travel time*.

Two test defects were found and fixed along the way, both mine rather than the code's: a
diagonal-walk assertion that assumed the player starts at the origin (they start at z=8), and
a wolf-stop assertion that did not allow the one frame of travel a wolf takes to cross into
its attack radius.

Adding the night also silently broke three older tests, which was informative: they ran for
100 simulated seconds, and the furnace now burns out in about 37. They had quietly become
tests about starvation. They now say out loud that the fire is not their subject.

### Hand edits

- The render layer needed a Three.js stand-in to be testable at all. `tests/helpers/three-stub.mjs`
  builds scene graphs without a GPU. It proves nothing about pixels — what it proves is that
  every module constructs and every `userData` hook the frame loop calls actually exists,
  which is the class of bug that otherwise presents as a black screen and an empty console.

### Verified

- 188 tests passing.
- `npm run package` emits `emberline.zip` at 0.29MB against the 35MB cap; game code 35.9KB.
- The full seven-night arc totals between 8 and 13 minutes, asserted.
- Every night's wolf wave is asserted to fit inside the night it belongs to, so the escalation
  curve cannot silently flatten on the hardest nights.
- Joystick and tap regions verified to tile a 393x852 screen with zero overlap and zero dead
  pixels.

### Open / next

- **NOT verified visually.** The browser preview was unavailable for this whole session, so
  nothing in Milestone 2 has been seen rendering: gates, wolves, the squad ring, the night
  lighting ramp, the phase banner, and the end-of-run card are all covered by smoke tests
  only. This is the first thing to check next session.
- **Still not verified on physical hardware.**
- **Tuning is now clearly overdue.** The furnace empties in ~37s against a 60s first day, so a
  new player loses before they have learned the controls. The systems are right; the numbers
  are not. That is the day 12-14 pass, but this specific number may need moving sooner.
- Next: Milestone 3 — four-resource economy, ghost-build plots, walk-in pads, survivors.
