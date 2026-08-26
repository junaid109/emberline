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

---

## Session 005 — 2026-08-25 — Seeing it at last, and a landscape to see

Two browser surfaces were unavailable, so the previous session shipped Milestone 2 without
ever seeing it render. This session built a way to look at it, found three bugs immediately,
and then built the winter landscape the game had been missing.

### Decisions locked

1. **The game is captured, not previewed.** An automated browser can run JavaScript in a page
   that is not being composited, but `requestAnimationFrame` never fires there, so the loop
   does not run. `tools/harness.mjs` takes the clock away from the browser: rAF becomes a
   queue the caller pumps by hand. Frames then advance on demand with an exact dt, which is a
   better instrument than a live preview — "advance exactly twelve seconds" is one call, and
   every capture is reproducible.
2. **Scenery placement is core logic, not decoration.** `src/core/scatter.js` is pure and
   tested, because where a prop may stand is a gameplay rule: none of it is harvestable, so a
   decorative conifer inside the playable circle would teach the player that walking into
   trees sometimes does nothing.
3. **Nothing stands on thawed ground.** The thawed circle is the entire playable area, and a
   static rock inside it reads exactly like an approaching wolf at night. Scenery starts
   outside `RING_MAX`, so thawed ground is clean worked earth and the frozen ground carries
   the snow-covered rubble — which is also truer to the fiction.
4. **The landscape is seeded, not random.** A judge and the entrant see the same world, and a
   screenshot stays reproducible.
5. **Everything decorative is instanced.** Six hundred props in six draw calls. Six hundred
   separate meshes would be six hundred draw calls a frame, and Playability is a quarter of
   the score.

### Prompted

- Asked for a way to observe the running game given that no browser surface would composite.
- Asked for a winter forest landscape with trees, rocks, shrubs and drifts, in biome bands.
- Asked for scenery placement to be tested as a gameplay rule rather than eyeballed.

### Result

The first capture found what four hundred passing tests could not: **wolves were never
rendered at all.** The pooling loop iterated the mesh pool rather than the entity list, so the
pool never grew past zero. Wolves spawned, walked, and mauled the furnace completely
invisibly, with nothing thrown and nothing logged. The logic moved out of the frame loop into
`src/render/sync.js`, where seven tests now cover it; reintroducing the bug fails all seven.

Two more followed from looking at it:

- **The dusk telegraph was nearly unreadable.** Gates sit at radius 26 and the camera framed
  exactly 52 units, so a lit gate landed on the frame edge, half off screen — and it is the
  only piece of information the night decision is made from. The camera is now framed from the
  gates rather than the heat ring, and a lit gate raises a tall beam.
- **Wolves marched in single file**, every one spawning on the same point and walking the same
  line. They now spread across the mouth of the gate.

Then the landscape: three biome bands running outward from the clearing — low rubble on the
frozen fringe, a dense treeline just out of reach that makes the playable circle read as a
clearing, and thinning woods dissolving into fog so the world has a horizon rather than an
edge. Snowy and bare conifers are mixed so the forest reads as weather rather than as one
repeated asset.

### Hand edits

- The per-band clearance rule was initially one number, which let camp scenery crowd a gate
  using the much smaller node clearance. Clearance is now per obstacle group.
- One test measured wolf spawn positions after the wolves had already walked inward, so it was
  really measuring their speed. It now samples on the tick each wolf appears.

### Verified

- 223 tests passing.
- `npm run package` emits `emberline.zip` at 0.30MB against the 35MB cap.
- Captured at 375x812: day, dusk with the telegraph lit, night with the landscape, wolves
  descending an abandoned gate, and a rally tap moving the squad — which exercises the tap,
  ground-pick and nearest-gate chain end to end.
- The landscape draws in at most 16 calls, asserted, and every instance matrix is asserted to
  be set and flagged for upload.

### Open / next

- **Still not verified on physical hardware.** Everything remains a desktop browser at phone
  dimensions.
- **Tuning is overdue.** The furnace still empties in ~37s against a 60s first day, so a new
  player loses before learning the controls. Capture runs had to patch the burn rate to reach
  a night at all, which is itself the clearest signal yet that this number is wrong.
- Tall trees in the near field can pass between the camera and the player when the player is
  at the southern edge. Not yet observed as a real problem; worth watching on a phone.
- Next: Milestone 3 — four-resource economy, ghost-build plots, walk-in pads, survivors.

## Session 006 — the game could not be won

### What happened

Chasing the overdue tuning note from Session 005, I stopped guessing at the burn rate and
instead asked the arithmetic a direct question: how much heat does a full seven-night run
cost, and how much fuel exists to pay for it?

    run length     686 s
    heat demand    1728
    fuel in world   360   (60 wood)
    wood needed     278   (the world contains 60)

**EMBERLINE was unwinnable.** Not badly tuned — impossible. Nodes never regrew, so the map
held a fixed 60 logs against a run costing 278. No skill, no route, no perfect play finished
seven nights.

223 tests passed over this. The reason is uncomfortable and worth writing down: *every* test
that reached night 7 got there by setting `world.heat = HEAT_MAX` on each tick, because each
was written to isolate some other subject — the phase clock, the telegraph, the squad. Every
one of those isolations was individually correct. Collectively they meant the fuel economy,
which is the entire game, had never once been executed.

### The fix, in two halves

**Supply.** `tickRegrow` in `src/core/nodes.js`: a node regrows one log every
`NODE_REGROW_SECONDS`, capped at `NODE_AMOUNT`. A continuous trickle rather than a respawn
event, so a clearing you stripped and one you took two logs from are genuinely different
places and "which clearing is worth walking back to" has a real answer.

18s is not a feel number. The whole forest regrows at 0.56 logs/s; one player hauling
flat-out moves 0.57. The world sits *just* under the player, so routing across clearings is
what closes the gap and camping a single one cannot. Both rates are computed from the real
constants and asserted, so the relationship survives future tuning.

**Learnability.** `HEAT_START` 60 → 78 and `HEAT_DRAIN_DAY` 1.6 → 1.1, set by one rule: a
player who touches nothing must live to *see* their first night. The old numbers put the fire
out 37s into a 60s first day — the player lost before finishing the tutorial they were giving
themselves, and the loss taught them nothing, because the wolves it was warning them about
had not appeared yet. Now that same idle player watches the ring close for a full day, reaches
dusk at 10%, and dies in the dark with a gate lit and wolves on screen. Same loss, but it
explains itself.

### tests/economy.test.mjs

The absent test, now present. It drives a **deliberately mediocre bot** — nearest-node greed,
no route planning, no anticipation of night — and asserts it survives seven nights on fuel
alone, with no pinned heat anywhere. If a clumsy bot wins, a human can; if a clumsy bot dies,
the tuning is too tight rather than the player being bad.

It is bracketed on both sides, because "winnable" and "trivial" fail identically from inside:
an idle player must still lose, the fire must drop below 75% at some point during a winning
run, and the wood standing in the ground at any instant must be less than half a run's cost —
so regrowth, not a stockpile, is what feeds the fire.

### Verified

- 233 tests passing (223 + 9 economy + 1 new node-lifecycle test).
- **Mutation-tested both fixes.** Reverting regrowth alone fails 3 tests including winnability;
  reverting the burn rate alone *also* fails winnability. Both were required — neither fix
  would have been sufficient, which is exactly what a single guessed constant would have missed.
- One existing test legitimately broke: a node now depletes *twice* inside a 20s window,
  because it regrows in between. Split into two tests — the second asserts depletion and
  revival stay paired, since the renderer hides a tree on one event and shows it on the other.
- Captured live at 393x852 with **no patched constants**, which was itself the point: 62s of
  idle play reaches dusk at 10% heat with the telegraph lit, and death lands 12s into night 1.
- End-of-run overlay measured through computed styles: full-viewport 86%-opaque backdrop,
  30px headline, 160x48 restart button — clear of the 44px touch minimum.

### Open / next

- **Still not verified on physical hardware.** Playability is 25% of the score and remains
  entirely untested by thumb.
- The canvas capture harness photographs the canvas only; the HUD is DOM and never appears in
  those shots. Worth remembering before reading a capture as "the HUD is missing".
- Night 1 reads only slightly darker than day in capture. Legible, which is what is scored,
  but the darkness ramp is subtler than intended.
- Next: Milestone 3 — four-resource economy, ghost-build plots, walk-in pads, survivors.

## Session 007 — the furnace was not actually the map

### What happened

`ringRadius()` in `src/core/heat.js` carries the comment *"the whole game is this
function"*. It was called from exactly one place: `main.js:153`, setting a texture
parameter on the ground.

The thawed circle was **drawn and then ignored**. The player crossed the frozen waste at
full speed, harvested wherever they liked, and the fire's only job was not hitting zero.
The signature idea the entire entry rests on — *the furnace IS the map, heat is the literal
radius of thawed ground* — was a picture of itself. Same failure mode as the unwinnable
economy, in a different organ: something load-bearing that nothing was actually leaning on.

### Making it real

`movePlayer` now takes the ring radius, and ground outside it is deep snow crossed at
`FROZEN_SPEED_MULT` (0.45) of normal speed.

Slowed rather than blocked, deliberately. A hard boundary would strand a player whose fire
had burned low *outside* it, with the very nodes needed to refuel it on the far side — a
death spiral with no counterplay. Slow is a cost you can choose to pay; a wall is a trap.
`tests/thaw.test.mjs` pins that: a player held at 0.5 heat at the world edge must still be
able to walk home.

Two relationships turned out to already be in the numbers, and are now asserted so they
cannot be tuned away by accident:

- `RING_MAX` (22) is exactly `NODE_RING_BASE + 2 * NODE_RING_STEP` — a **full furnace thaws
  precisely as far as the outermost trees**. "The fire is full" and "the whole forest is in
  reach" are the same sentence.
- `ringRadius(HEAT_START)` is ~18.5, so the run **opens** with the outer trees on frozen
  ground. A new player walks at them, hits deep snow, and learns the rule in one gesture,
  before any wolf exists to complicate it. That is the tutorial, and nobody had to write it.

A probe of a full winning run: 7% of ticks are spent on frozen ground. Right, I think — it
is a constraint you route around rather than fight.

### The self-referential test trap

First mutation run: setting `FROZEN_SPEED_MULT = 1.0` (mechanic off) failed only ONE test,
and only the constant-range guard. The behavioural test computed its expectation *from the
constant*, so expected and actual moved together and it happily passed a disabled mechanic.

Added a test that measures both grounds and compares them to each other, deriving nothing
from the constant. Now `= 1.0` fails two tests, and deleting the wiring inside `movePlayer`
fails two others — which is the mutation that matters, since losing the wiring is exactly
how `ringRadius` went missing in the first place.

### The player was invisible on the ground the mechanic sends them to

A zoomed capture settled it: parka `0x2e86c1` (mid blue) under hood `0xf4f6f7` (near white),
standing on `0xdce8f2` snow. On paper three different colours; in practice a shape you had
to hunt for — and now the frozen waste is somewhere the player has an active reason to be.

Extracted `src/render/palette.js` (no THREE dependency) so contrast is a **rule with a test**
rather than a matter of taste. `tests/palette.test.mjs` asserts the player reads against
*both* grounds, the rim is distinct from both sides it divides, and the player cannot be
confused with a guard or — the one that would actually cost a run, read at night in a hurry
— with a wolf.

The obvious fix was an ember parka, on the reasoning that the fire-keeper should carry the
fire's colour. **The test rejected it**: warm orange sits 102 RGB units from tan worked
earth, trading disappearing on snow for disappearing on the other half of the map. A search
of the colour space against everything else on the field returned bright ice-cyan, 213 units
clear of its nearest neighbour.

It is the better idea as well as the better number: warm belongs to the furnace, cold
belongs to you, and the game is the running between them. The one unmistakably orange thing
on screen stays the thing you are protecting. Plus a dark contact shadow, because no single
colour can be trusted on ground that changes underfoot.

### Verified

- 252 tests passing.
- Mutation-tested both the constant and the wiring; both now fail the right tests.
- Driven live at 393x852 through **real PointerEvents on the canvas**, which exercises the
  touch-stick path end to end rather than calling the simulation directly.
- Captured before and after at 4x zoom on the player.

### Open / next

- **Still not verified on physical hardware.** Unchanged, and still the biggest risk.
- **The player is about 6 x 10 CSS px** at the reference layout (393px / 62 world units =
  6.34 px per unit, foreshortened by the 52-degree camera). Colour and shadow have made that
  10px legible, but whether it is *comfortable* under a thumb is precisely the question a
  device answers and a desktop capture cannot. Deliberately not scaled up on a guess.
- Night 1 still reads only slightly darker than day.
- Next: Milestone 3 — four-resource economy, ghost-build plots, walk-in pads, survivors.

## Session 008 — measuring the night, and the artefact that did not exist

### The night was fine; my eye was not

Twice I logged that night "reads only slightly darker than day". Rather than tune on that
impression, I sampled pixels from the live renderer at three ground points, day and night:

    snow (near)   174 -> 98   0.56x
    snow (mid)    175 -> 92   0.53x
    thawed earth   75 -> 37   0.49x

Night is a clean halving. **The note was wrong** — a misread of a small JPEG, not a defect.
Retuning on it would have made the game worse in the name of a problem that was not there.

The existing tests said only "night is darker than day", which a 1% dip satisfies. Pinned the
actual policy instead: total scene light must land between 20% and 40% of day. sRGB response
turns that ~29% light ratio into the ~0.5 pixel ratio measured above, which is why the light
budget is the thing asserted and not the pixel. Added a monotonicity test too — dusk and dawn
must ramp, because the dusk window IS the rally decision and a hard cut would read as a
penalty landing rather than a warning given.

### The Design Intent Document

A required deliverable, and it did not exist. Two rules, both submission-fatal, and neither
visible by looking at the finished file:

- **500 words maximum.**
- **No identifying information.** Judging is anonymous.

Both are the kind of rule that breaks by accident. A word count drifts past the limit one
edit at a time. An identifying detail arrives on autopilot — a repo URL pasted as a
reference, a name in a credit line — at exactly the moment nobody is proofreading for it.

So the document is written as `docs/design-intent.md` (reviewable in diffs) and rendered by
`tools/design-doc.mjs`, which **refuses to emit the .docx** if either rule is broken. It
scans for URLs, GitHub references, email addresses, bylines and copyright lines, and counts
words over the prose only — markdown syntax and the file's own HTML-comment notes excluded,
or the checker would fail on its own instructions.

`tests/design-doc.test.mjs` tests the checker as well as the document, because a broken
checker and a compliant document look identical from outside: it feeds the checker one
example of every identifying shape and asserts each is caught, and asserts clean prose comes
back clean so the guard is not simply always angry.

Currently **450/500 words**, clean. Verified the emitted .docx by reading its XML back: one
Title, six Heading 1s, 18 paragraphs, em dash intact as UTF-8, italics preserved. No
LibreOffice or pandoc on this machine, so a visual render was not possible — the structural
read is what could honestly be checked.

The .docx is gitignored and generated by `npm run doc`; the markdown is the source of truth,
matching how `emberline.zip` is already treated.

### Verified

- 264 tests passing.
- `emberline.zip` still 0.30MB, two entries, `index.html` at top level, and neither the
  document nor the new `docx` devDependency leaks into it.

### Open / next

- **Still not verified on physical hardware.**
- The design document describes the game as it now stands. If Milestone 3 lands it needs
  revising — and it is 50 words from the ceiling, so something would have to go.
- Next: Milestone 3 — four-resource economy, ghost-build plots, walk-in pads, survivors.

## Session 009 — a world that is not the same world every time

### The world was a fixed set

Ten trees, ten fixed angles, one scenery seed. Every run generated the identical forest, so
a second run taught the player nothing they had not already seen — a direct cost to the only
reason anyone replays a ten-minute game.

`src/core/worldgen.js` now generates the layout from a per-run seed. What varies and what
does not is deliberate: the three node BANDS stay fixed, because the relationships they
encode carry the whole opening of the game — a full furnace thaws exactly to the outer band,
and a run opens with that band just out of reach. Which angle and which radius *inside* a
band is rolled fresh. Every run is a different forest and the same lesson.

### Coal, and why not a fifth resource

The HUD had four slots and three had been permanently zero since the first milestone: the
interface was promising an economy the game did not have. Rather than invent something new,
`stone` became **coal** — a stone does not burn, and coal is a second FUEL, which deepens
the loop that already exists instead of opening a second one beside it.

Every seam lies **outside the thawed ring**, by construction and by test. That is the whole
design: coal burns at 15 against wood's 6, but the good fuel always sits on ground crossed at
FROZEN_SPEED_MULT. The thaw mechanic pays for itself rather than being decorated.

A probe of a winning run: 310 wood against 3 coal. Coal is *rare under naive play*, which is
correct — it is a choice a player makes when the fire is low and they want a big hit, not the
default route. A test pins that it is worth the walk (a lump beats two logs) and that the
coal in the ground never outweighs the forest, so it stays a detour.

### Boulders

Blocking obstacles, so the shortest line between two points is not always available.
Resolved by *ejection* rather than by refusing the move: refusing lets a player hold the
stick into a rock and stick there, which reads as the game having frozen, where sliding
around it reads as a rock.

### Fuzzing found three real bugs

The point of a generator is that nobody will ever look at most of its output, so
`tests/worldgen.test.mjs` runs 240 seeds against playability invariants. On the first run it
failed three of them, all of which the default seed happened to hide:

1. **The rejection sampler gave up.** Fourteen boulders would not fit the narrow band that
   also holds the coal seams and three gate exclusion zones, so some seeds quietly generated
   fewer obstacles than others. Now nine, and asserted exactly nine on every seed.
2. **Two harvestables generated 1.6 units apart.** Jitter either side of bands
   NODE_RING_STEP apart lets adjacent bands come within 0.8 units — well inside harvest
   range. The harvest loop takes the FIRST node in range and stops, so which tree you were
   cutting would have depended on array order: invisible and unpredictable. Placement now
   retries against a minimum spacing, falling back to the un-jittered slot.
3. **A boulder near the rim could eject the player out of the world.** Ejection runs after
   the world-edge clamp, so the outer limit had to be bounded by
   `BOULDER_OUTER + BOULDER_RADIUS + body < WORLD_RADIUS - WORLD_EDGE_MARGIN`. Now pinned.

Every other invariant is the same kind of rule: no seam walled off by rock, no boulder in a
gate mouth, no pair of boulders forming a gap narrower than the player, nothing generated on
the pad, ejection never producing NaN. A run that generates a walled-off seam is not a
variation, it is a broken run that only some players get.

### Verified

- 294 tests passing, 240 seeds fuzzed.
- Captured two consecutive runs at 393x852: visibly different forests, boulders and seams.
- A first capture showed the seams reading as specks of grit beside the boulders, so the
  geometry was sized up from the measurement rather than judged in isolation — a player
  cannot choose to walk out for fuel they cannot see is there.
- New palette rules: a seam must never be mistaken for a boulder (one is worth the walk, the
  other is in the way), and the ember glint is drawn unlit so it survives the night.
- The design document contained two claims the code had just made false — "wood is the only
  fuel" and "one resource". Corrected; the checker then rejected the result at 528 words and
  the prose was trimmed to 498 rather than the limit being moved.

### Open / next

- **Still not verified on physical hardware.**
- Requested and not yet built: **wandering animals** and **random events**. The generator and
  its invariant harness are the foundation both will use.
- The scenery is now rebuilt per run rather than once, which is more per-restart work than
  before. Not measured on a phone yet.

## Session 010 — wildlife and weather

### Hares, and why they are a decision

A hare is not scenery. Meat is the only thing in the game that makes a night cheaper — the
guard squad eats one at dusk and fights harder that night — so the daylight spent chasing one
is daylight not spent hauling fuel. That is a trade on axes the game already has, which is
the only kind of content worth adding to something judged on Focus.

They **dart and freeze** rather than fleeing steadily. A steady flee is either uncatchable or
a formality depending on one speed constant, and neither of those is a chase; the still beat
is the player's window, and it is the whole interaction. It is also what a hare actually does.

The load-bearing test is that a chase can be **won**: hares live out in the wilds, which the
player crosses at FROZEN_SPEED_MULT, so an uncatchable hare would not be a hard chase — it
would be a lie about a choice that does not exist. The mirror is tested too: a darting hare
must outrun the player, or meat is a pickup rather than a decision.

Feeding is automatic at dusk. No button, no inventory screen. The player's only decision was
whether to spend the daylight.

### Weather

One event rolled per day: calm, blizzard, or a supply cache dropped out in the wilds. Most
days are ordinary by weight, and that is tested in both directions — a world where every day
is an emergency has no emergencies.

**Day one is always calm, on every seed.** Not politeness: the first day is the only tutorial
this game has, the place a player learns what a normal burn feels like and that the outer
trees are out of reach. A blizzard during it would teach them that the normal state of the
world is emergency, and every judgement they formed afterwards would be calibrated against a
lie.

A cache is walked into, not harvested. Making the player stand and chop a windfall would turn
a gift into an errand.

### Two bugs the tests caught

- **A bootstrap clause was re-rolling the weather on the first frame of every run.** I had
  written `entered === 'day' || (entered === null && …)` to catch day one, and it quietly
  overwrote any state it found — including two tests' setup. Day one is now settled in
  `createWorld`, so the per-day roll only fires on a real transition.
- **A degenerate roll stacked every hare on one point.** `createWorld(() => 0.5)` feeds a
  constant straight into hare placement, so all four spawned identically and a player standing
  there took the lot in one tick. Real play uses Math.random, but it is worth a test.

### Verified

- 321 tests passing.
- Captured live at 393x852: hares rendering with upright ears beside a boulder, and a supply
  cache at night with its green flag readable across the field.
- New palette rules: a hare must never be mistaken for a wolf (they share a silhouette family
  and the same ground — running TOWARD a wolf at dusk is the worst error a palette could
  cause), and the cache flag must be distinct from everything else in the wilds. The first
  green I picked sat 96 RGB units from the boulder grey and the test rejected it.
- Reaching a cache day needed the burn rate and the wolves patched, since an idle player never
  survives to day two. **Constants restored and re-verified** — 1.1, 3, 2.

### Open / next

- **Still not verified on physical hardware.**
- **Focus is now the risk.** Focus is 15% of the score, and this session added wildlife,
  weather, caches and a squad buff on top of coal and boulders. Each earns its place by
  feeding the fire or the night, and nothing added a second meter or a spend screen — but the
  design document had to be trimmed three times to fit, and the sentence cut to make room was
  the only one about the palette. That is the honest signal to watch.
- The design document is now at 497/500 words and describes hares, weather and coal. There is
  no room left for another system without something being cut.

## Session 011 — no new systems, two real defects

Agreed with the brief to stop adding and start hardening. Both of these are things the game
already had, done properly.

### The offline guarantee, and a guard that could not fail

A single external request during play is an automatic disqualification, and it is the one
rule invisible from inside the finished game: it only shows up on a machine with no network,
or on a judge's.

The validator already rejected a literal `https://`. That catches an address somebody typed,
not a request assembled at runtime out of a variable — which reads as ordinary code to any
regex hunting for "https". So the **capability** is now banned: fetch, XMLHttpRequest,
WebSocket, EventSource, sendBeacon, importScripts, dynamic import. Scanned in index.html
only, since Three.js legitimately carries loaders this game never calls.

Then the part worth writing down. The first version of that list went through a shell
heredoc, which turned every `\b` into a **literal backspace character (0x08)**. The patterns
read as "a backspace, then fetch", matched nothing whatsoever, and the guard reported a clean
build every time. Twelve mangled characters and the whole check was decorative. This is the
third time a heredoc has silently eaten a backslash in this project.

A guard that cannot fail is worse than no guard: it is no guard plus false confidence. So the
tests now prove every pattern matches the thing it names, and reject any pattern containing a
control character. Mutation-tested by reintroducing the mangling — 15 boundaries mangled,
four tests fail, including two older canvas checks that turned out to lean on the same escape.

Two existing tests used `fetch("./data/levels.json")` as an acceptable relative path. Their
subject stands; the example does not, for a stronger reason than they knew — **fetch() of a
local file is blocked under `file://`**, which is exactly how a judge opens an unzipped
submission. Such a build would not be reaching the network, it would simply be broken.

Also verified at runtime rather than only statically: the real unpacked zip, served and
loaded, makes **exactly two requests** — the page and `./vendor/three.js`, both same-origin
— with zero console errors.

### A GPU leak I introduced last session

Measured frame cost first, since Playability is a quarter of the mark: at 393x852 with the
buffer at 786x1704 (DPR correctly capped at 2), **0.32ms/frame by day and 0.34ms at night**,
around 49x headroom against 60fps. That measures CPU-side cost — `__step` submits draw calls
without waiting for the GPU — so it proves the simulation and scene graph are not the
bottleneck, and that any phone trouble would be fill rate, where MAX_DPR is already the lever.

What the same look found: **nothing in the project disposes anything**, and `buildPartsets()`
ran on every `createScenery()` call. Harmless while the landscape was built once per session
— but making the layout per-run (Session 009) meant every restart allocated ~13 geometries,
13 materials and 600 instance matrices, and removing a mesh from a Three.js scene frees none
of it. A judge restarting five times leaked five landscapes' worth of GPU memory. My own
change caused it.

The geometries and materials are now built once, lazily (THREE is a global from a separate
script tag, so module scope is too early), and `createScenery` returns a `dispose()` that
removes the meshes and frees their instance buffers — but deliberately does **not** dispose
the shared geometry or material, since the next landscape draws from them.

Three tests: a rebuild allocates nothing new, dispose frees the buffers while leaving the
shared parts intact, and a landscape built after a dispose is still complete — that last one
proving the shared parts survived in practice rather than that a flag stayed false.
Mutation-verified.

### Verified

- 329 tests passing.
- Captured at 393x852 after the refactor: the landscape still draws. Sharing geometry across
  meshes is exactly the kind of change that silently blanks a scene.

### Open / next

- **Still not verified on physical hardware.** Unchanged, and now the only large gap.
- Gate meshes still build a lamp sphere and beam cylinder per call, so three gates' worth of
  small geometries leak per restart. Far smaller than the landscape was, but the same shape
  of bug.

---

## Session 012 — the last leak, and proving it in a real context

### Gates

The item left open at the end of Session 011, closed. `createGateMesh` built its lamp sphere
and warning-beam cylinder inline, so every restart allocated three more of each and freed
none — the same bug as the landscape, three orders of magnitude smaller, and invisible for
the same reason: it cost nothing while gates were made once per session.

Both geometries are now module-level singletons alongside the posts and lintel. The two
materials stay per-gate, and that is not an oversight: each lamp lights independently, so
they cannot be shared. That makes the materials the one thing a gate owns outright and the
one thing a restart has to release, so gates expose `userData.dispose()` and `main.js` calls
it when it tears down the previous run's meshes.

Nodes and boulders were checked at the same time and are clean — they draw from shared
geometry and own nothing, so removing them from the scene is the whole of their cleanup.

Three tests: building a gate allocates no geometry, dispose frees exactly the two owned
materials and leaves the shared geometry alone, and a gate built after a dispose still
lights up. Mutation-verified — reverting both halves fails the first two.

### A restore that went the wrong way

Cleaning up after the mutation I ran `git checkout -- src/render/actors.js`, which reverted
to HEAD and so discarded the fix along with the mutation. Caught immediately by grepping for
the new symbols, and re-applied. Worth recording because the mutation workflow is only safe
if the restore is scoped to the mutation: `git checkout` is the wrong tool while the fix
itself is uncommitted.

### Verified

- 332 tests passing.
- Driven in the browser through the rAF harness at 393x852: lit the fire, ran to dusk, and
  captured the telegraphed gate — lamp and beam both drawing from the now-shared geometry in
  a real WebGL context, which the Three.js stub cannot prove.
- Then restarted three times and ran to dusk again: a different world, a different gate lit,
  lamp and beam still drawing. Zero console errors. This is the check that matters, since
  sharing geometry across meshes is exactly the change that silently blanks a scene on the
  second build.

### Open / next

- **Still not verified on physical hardware.** Unchanged, and now clearly the largest gap.
- Netlify still needs one interactive `netlify-cli login` before `npm run deploy` works.
