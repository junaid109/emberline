# Build Log: EMBERLINE

Genre: Survival & Resource Management

A note on honesty: this log records what actually happened, including three
occasions where the game was broken in ways the test suite said it was not, and
one where the AI's own guard code was inert. The failures are the useful part.

---

## Decisions locked so far

- **Core loop:** gather fuel → feed the furnace → the thawed circle grows →
  more of the world becomes reachable → survive the night. Fuel is the only
  currency and the fire is the only sink.
- **Signature mechanic: the furnace *is* the map.** Heat is not a bar. It is the
  literal radius of thawed ground. Feed the fire and the world opens; let it
  burn low and the snow closes in. There is no meter to watch because the meter
  is the ground you stand on.
- **Genre floor:** gathering (wood, coal, meat), conversion (fuel refined into
  thawed territory; meat upgrades the guard squad for a night), escalating
  threat (seven nights, each longer, colder, and with more wolves). All three
  present.
- **Three resources, all real.** Every resource with a counter on screen can be
  gathered and spent. Anything that could not be was deleted, not stubbed.
- **Escalation is within one session.** Judges play one sitting, so nothing is
  gated behind a later unlock. The whole seven-night arc is roughly ten minutes.
- **Controls: one thumb, portrait.** Left thumb walks via a floating joystick.
  A tap anywhere else rallies the guard squad to the nearest gate. No aiming, no
  menus, no inventory screen.
- **Combat resolves itself.** The only night decision is *where the squad
  stands*, made once, under a five-second clock. Travel time is the price of
  choosing wrong.
- **Interaction verb: walk-in pads.** Standing on the furnace deposits fuel.
  There are no menus in the game at all.
- **Art: procedural low-poly geometry written in code.** No model files, no
  image files, no audio files. Visual polish is unscored and asset files
  threaten both the 35MB cap and the no-network rule.
- **Architecture: pure logic in `src/core/`, with zero rendering dependency,**
  unit-testable headlessly. `src/render/`, `src/input/`, `src/ui/` consume it.
  Dependency direction points one way only.
- **All tuning lives in one constants file,** so a balance pass never means
  hunting magic numbers across ten files.
- **Packaging is validated automatically.** The build refuses to emit a zip that
  breaks a submission rule.
- **Scope deliberately excluded:** crafting tree, inventory screen, dialogue,
  aiming, multiplayer, second currency.

### Deliberately accepted risk

The guidance lists "dynamic day and night cycles, and dynamic weather" under
*where not to spend your time*. Emberline has both. The day/night cycle is not
ambience here — it *is* the escalating threat the genre floor requires, and the
required within-session escalation is carried entirely by it. That one is a
considered call. The per-day weather roll is a weaker case and is flagged in the
final session below.

---

## Session 1 (2026-08-21): research and design lock

**Tool:** Claude Code

**What I built:** no game code. Rules extraction and a locked design spec.

**Key decisions and why:** genre picked as Survival & Resource Management. The
session shape was chosen as a seven-night cycle over two alternatives (a single
rising-storm clock, and an expedition push-your-luck structure) because it
delivers escalation *within one session*, which the guidance explicitly
requires.

**Pivots:** two, both from the AI pushing back on my initial concept and both
adopted. First, I wanted heavy generated 3D assets; polish is unscored and asset
files compete for the 35MB budget, so that was cut to procedural geometry.
Second, my reference point's real progression is multi-session and meta, which
the rules do not reward — so the whole design was restructured around a
single-session arc.

**Biggest problem:** the temptation to design from features rather than from the
loop. Fixed by extracting the judging weights first and checking every proposed
idea against them.

**What I learned:** read the binding constraints directly from the source rather
than working from a summary. Several of them (unminified code, `vendor/` folder
name, zero network requests) shape the build pipeline and are painful to
retrofit.

**Where things stand / next:** design spec written. Next is the playable slice.

---

## Session 2 (2026-08-21): the playable slice

**Tool:** Claude Code

**What I built:** the packaging pipeline and its validator *first*, before any
gameplay — then the floating joystick, movement, resource nodes, proximity
harvesting, a visible carry stack on the player's back, the furnace deposit pad,
and the heat ring driving a visible thawed radius.

**Key decisions and why:** building the validator before the game meant the
submission rules were enforced mechanically from day one rather than checked in
a panic at the end. Three.js is bundled as a plain script tag rather than an ES
module, because an import map fails on `file://` — if a judge double-clicks
`index.html` instead of serving it, a module build shows them a black screen.

**Pivots:** the camera. The heat ring was the whole idea and was barely visible
in the original framing, so the camera was reframed to a diorama view.

**What changed after playtesting:** nothing — see the honesty note at the end.
No outside player had touched it at this stage.

**Biggest problem:** the joystick had a stuck-stick bug and an activation region
that fought the harvest interaction. Found by review, not by tests.

**What I learned:** mutation testing is not optional. The deposit tests were
re-run against three deliberately broken implementations to confirm they would
actually fail. This became standard practice for the rest of the build.

**Where things stand / next:** 73 tests passing, zip at 0.29MB. World state was
specified to live in a core module and instead ended up in the frame loop, with
no coverage. Flagged to extract before building anything on top of it.

---

## Session 3 (2026-08-23): world extraction, and bugs only a screenshot could find

**Tool:** Claude Code

**What I built:** extracted all world state and system ordering out of the frame
loop into a testable core module.

**Biggest problem, and the lesson of the whole project:** I looked at the game
for the first time in a real browser and found three render bugs that a full
green test suite had no way to detect. The tests verified the numbers; nothing
verified that the numbers reached the screen.

**What I learned:** automated tests and visual verification catch disjoint
classes of bug. From here on, every session ends with a capture at the reference
phone layout, and I built a small harness to drive the game deterministically so
those captures could be taken reliably.

**Where things stand / next:** core extracted, ready for the night systems.

---

## Session 4 (2026-08-25): the night

**Tool:** Claude Code

**What I built:** seven nights, the dusk telegraph, three gates, wolves, the
guard squad, rally taps, and win/lose.

**Key decisions and why:** the dusk telegraph is the only information the night
gives you, and it never lies. Combat resolving itself keeps the decision to a
single legible choice — placement under a clock — rather than diluting it with
aiming.

**Biggest problem:** the wolves did not render at all. Again invisible to the
test suite, again found by looking. The frame was also too narrow to fit the
gates, so the thing the player was meant to be reading was off-screen.

**What I learned:** "the system works" and "the player can see the system" are
two separate claims and need two separate kinds of proof.

---

## Session 5 (2026-08-25): the landscape

**Tool:** Claude Code

**What I built:** the winter landscape — biome bands of pines, snow-laden pines,
snags, rocks, shrubs and drifts, roughly 600 props batched into about 13 draw
calls, deliberately kept off the thawed ground so it never obscures the ring.

**Key decisions and why:** instanced batching rather than 600 individual meshes.
Playability is a quarter of the score and 600 draw calls per frame is the
difference between a smooth phone and a slideshow.

---

## Session 6: the game could not be won

**Tool:** Claude Code

**What I built:** no features. A fix for the fact that Emberline was
mathematically unwinnable.

**Biggest problem — and the worst miss of the project:** a full run costs 1728
heat. The world contained 360. No resource node ever regrew. The game could not
be completed by a perfect player, and **223 passing tests had not noticed**,
because every test that reached the final night set the heat to maximum first in
order to get there. The tests all asserted the endgame worked; not one asserted
you could *arrive* at it.

**How I solved it:** node regrowth, plus a retune of starting heat and drain
rate. Mutation testing proved both halves were required — reverting either one
alone made the game unwinnable again.

**What I learned:** test setup that skips the hard part of the game will hide
the fact that the hard part is impossible. Add at least one test that plays the
whole arc from a real starting state and asserts nothing along the way.

---

## Session 7: the signature mechanic was decoration

**Tool:** Claude Code

**Biggest problem:** the function computing the thawed radius — the number the
entire game is named after — was called from exactly one place, where it set a
ground texture parameter. Nothing in the simulation consulted it. The furnace
was not the map; it was a picture of a map. Standing on frozen ground cost the
player nothing.

**How I solved it:** wired the radius into movement, so crossing frozen ground
actually halves your speed. That single change turned the ring from a visual
into the price list the design document claims it is.

**Pivots / what didn't work:** my first attempt to make the player visible on
snow was an ember-orange parka. A contrast test I had just written *rejected my
own colour* as too close to the thawed earth. A colour-space search produced an
ice-cyan that clears both grounds by a wide margin.

**A second trap:** the test I wrote for frozen-ground movement derived its
expected value from the same constant the implementation used, so setting that
constant to "no effect at all" left the test green. Replaced with a test that
measures movement on both grounds and compares them, deriving nothing from the
constant.

**What I learned:** a test that imports the constant it is testing can be
self-fulfilling. Assert on observable behaviour, not on a restatement of the
implementation.

---

## Session 8: measuring the night, and a missing deliverable

**Tool:** Claude Code

**What I built:** the Design Intent Document, plus a checker that refuses to
emit it if it exceeds 500 words or contains identifying information.

**What didn't work — my own judgement:** I had claimed the night was "barely
darker" and was about to retune it. I sampled the actual pixels instead: night
renders at roughly half of day luminance. My impression was simply wrong, and
the correct action was to correct the claim, not the game.

**What I learned:** measure before tuning. It cuts both ways — measurement had
already caught things I thought were fine, and here it stopped me breaking
something that already was.

---

## Session 9: a world that is not the same world every time

**Tool:** Claude Code

**What I built:** seeded procedural generation, so the forest, coal seams and
boulders are laid out fresh each run. Added coal (a hotter second fuel) and
boulders (which make the route rarely straight).

**Key decisions and why:** coal is a second *fuel* rather than a fifth resource.
It deepens the loop that already exists instead of opening a second one beside
it — depth over breadth, which is what the Focus criterion actually rewards.

**Biggest problem:** the default seed hid three real bugs. Fuzzing 240 seeds
found all of them — a sampler that silently gave up, two harvestables placed
inside each other, and a boulder near the world edge that could eject the player
out of the world entirely.

**What I learned:** procedural generation must be tested as invariants across
hundreds of seeds. "It looked fine on the default seed" is not evidence.

---

## Session 10: wildlife and weather

**Tool:** Claude Code

**What I built:** hares (the only source of meat, which feeds the squad and
makes a night materially cheaper) and a per-day weather roll (blizzard, supply
cache, or calm).

**Key decisions and why:** meat is a real decision rather than a collectible —
catching one costs daylight you needed for fuel, and buys you a stronger night.

**Biggest problems:** the weather bootstrap re-rolled on the first frame of
every run, overwriting test setup; and with a constant random source all four
hares stacked on a single point.

**In hindsight:** this is the session I would question. See the final entry.

---

## Session 11: no new systems, two real defects

**Tool:** Claude Code

**What I built:** nothing new — by decision. I had started proposing more
content and pulled back, because breadth is exactly what the Focus criterion
penalises.

**Biggest problem:** the validator that guarantees the game never touches the
network was **completely inert**. It had been written through a shell heredoc
which silently converted twelve regex word-boundary escapes into literal control
characters, so the patterns matched nothing and reported a clean build every
time. A guard that cannot fail is worse than no guard: it is no guard plus false
confidence. Caught only because I wrote a test asserting each pattern actually
fires.

**Second problem:** a GPU leak I had introduced myself in session 9. Making the
landscape per-run meant every restart allocated a fresh set of geometries and
materials, and removing a mesh from the scene frees neither. A judge restarting
five times leaked five landscapes' worth of memory.

**What I learned:** assert that your safety nets actually catch things. Write a
test that deliberately violates the rule and confirm the guard trips.

---

## Session 12: the last leak, and a review against the guidance

**Tool:** Claude Code

**What I built:** closed the matching leak in the gate meshes, then re-read the
official design guidance line by line against the actual build.

**Biggest problem found by that review:** the HUD displayed four resources and
the game could only ever award three. **Water was a permanent zero** — never
gathered, never spent, on screen for the entire run. The submission checklist
says in as many words that nothing may be "half-finished or left in as a stub",
and a counter that can never move is the clearest possible example. Worse, a
test was actively protecting it: it asserted the *list* of four resources rather
than asserting the list was *true*.

**How I solved it:** deleted water. The replacement test asserts that every
resource with a counter on screen is one the simulation can actually grant —
which is the invariant that was missing all along. Mutation-verified by putting
water back and watching it fail.

**A process failure worth recording:** while cleaning up after a mutation test I
reverted the file with a plain checkout, which discarded the *fix* along with
the mutation. Caught immediately, but the lesson stands: while the fix is still
uncommitted, the restore has to be scoped to the mutation.

**What I learned:** re-read the brief late, not just early. Several of these
requirements are trivially checkable and I had been carrying a stale summary of
them in my head instead of the actual text. The guidance is now saved into the
repository verbatim so claims about "what the rules say" can be checked against
the wording.

**Where things stand:** 333 tests passing. The game is playable end to end, has
win/lose/restart, escalates within a single session, runs in fixed portrait, is
fully self-contained, and has been verified offline from a local server against
the real unpacked zip.

---

## Honest gaps, as of the latest session

1. **It has never been played by another person, and never on a physical
   phone.** The guidance is explicit that one playtest with someone new will
   surface more than any amount of solo polish, and Playability is 25% of the
   score. Everything so far has been verified in a desktop browser emulating a
   phone viewport. This is the single largest remaining risk and it is not a
   technical one.
2. **The weather system is the weakest thing in the build.** "Dynamic weather"
   is named in the guidance under where not to spend your time. It is the newest
   system and the least connected to the core loop. It works and is not
   half-built, so it does not trip the stub rule — but if anything gets cut for
   focus, it is this before anything else.
3. **The design-intent document needs to be put on the official template.** The
   text is written and passes the 500-word and no-identifying-information
   checks, but the checklist specifies the template and that has not been
   confirmed.
