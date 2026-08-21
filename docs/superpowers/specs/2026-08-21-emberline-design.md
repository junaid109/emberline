# EMBERLINE — Design Spec

**Competition:** Meta Horizon Creator Competition: Game Prototype (MHCP)
**Genre entered:** Survival & Resource Management
**Deadline:** 2026-09-08, 1:00 PM PDT
**Spec date:** 2026-08-21

---

## 1. Pitch

You are the last stoker of a dying furnace in a whiteout. The furnace throws a **visible ring of thawed ground**. Inside the ring, things live and work. Outside, the snow takes them.

Every log you haul is a choice: burn it to hold the line, spend it on walls, or spend it to thaw a survivor out of the ice. Survive seven nights.

**The signature idea:** the furnace *is* the map. Heat is not a number on a bar — it is the radius of the world you are allowed to use. Feeding the furnace physically expands your playable ground. Letting it dim makes the snow creep inward and swallow buildings you already paid for.

---

## 2. Judging alignment

| Criterion | Weight | How this design serves it |
|---|---|---|
| Player Engagement | 30% | Escalating 7-night arc, visible growth, night pressure |
| Playability | 25% | One joystick plus tap. No menus anywhere. Walk-in pads for all interaction. |
| Core Loop Design | 20% | Gather → haul → allocate across competing sinks → survive → escalate |
| Focus | 15% | One loop, deep. No meta-progression, no multiplayer, no weather sim. |
| Originality | 10% | Heat-as-playable-radius; water bought with warmth; animals as threat and food |

**Explicitly not built** (per official design guidance): multiplayer, ragdoll or vehicle physics, detailed creature animation, dynamic weather systems.

---

## 3. Core loop

One session is approximately 10 minutes, structured as 7 night cycles.

### Day phase (60s on night 1, shrinking to 45s by night 7)

- Player moves with a virtual joystick.
- Walking into a resource node auto-harvests it. Harvested items **stack visibly on the player's back** as a growing tower, up to a carry cap.
- Player hauls the stack to a sink and **stands on a walk-in pad**; items fly off one at a time with a rising tick, draining into the sink.

### Dusk telegraph (5s)

- Arrows illuminate at the treeline showing **which of the three gates** the wolves will use.
- This is the player's rally decision window.

### Night phase (25s on night 1, growing to 50s by night 7)

- World lighting collapses to the heat ring plus any built torches.
- Furnace heat drains at roughly 2.5x the day rate.
- Wolves spawn at the telegraphed gates. The **guard squad** auto-fights wherever it was last rallied. Combat is fully automatic — the player never aims or attacks manually.
- Enemies that get past the squad chew walls, steal from loose ground piles, and drag off survivors.
- The player is simultaneously hauling fuel in the dark and re-tapping the squad as a second gate breaks.

### Dawn

- Quick tally card: fuel remaining, survivors alive, resources banked, night N of 7.
- Survivors auto-gather at a reduced rate throughout the following day.

---

## 4. Resources

Four resources. They are deliberately **not** interchangeable — each is bought with a different cost.

| Resource | Node | Real cost of gathering it | What it buys |
|---|---|---|---|
| Wood | Trees | Time | Furnace fuel — the session clock itself |
| Meat | Animals (auto-attacked on contact) | Risk — you fight for it | Feeds survivors; gates headcount |
| Water | Ice chunks, then **melted at the furnace** | **Heat** — melting burns fuel | Survivors dehydrate without it |
| Stone | Rock nodes (slowest harvest) | Opportunity — long commitment, no food gained | Walls, traps, furnace upgrades |

**Water is the interesting one.** It is the resource you buy with warmth, which puts it in direct competition with the thing keeping you alive. It is the first thing a player is tempted to skip, and skipping it is a slow-acting mistake.

**Meat gives wildlife a second role.** The same animals that raid at night are hunted during the day. Predator and prey, one asset, two systems.

---

## 5. The allocation squeeze

Wood is the contested currency. Three sinks compete for it:

| Sink | Buys | Cost of choosing it |
|---|---|---|
| Furnace | Heat → larger ring → more workable land, wolves repelled | Survive-now, leaves no lasting asset |
| Walls / torches | Hold a gate without the squad | Dead investment if you guessed the wrong gate |
| Thaw a survivor | +1 body, assignable to Gather or Guard — compound growth | Permanently raises food and water drain |

Rescuing more survivors means faster gathering and better gate coverage, but a heavier consumption drain that pulls you back out into the cold more often. That is the central squeeze.

---

## 6. Adopted mechanics from outside the genre

### 6.1 Tycoon ghost-build plots

Dashed outlines on the ground show **ghost previews** of what could be built there, with a price label. The camp becomes a visible menu of goals with zero UI. Walking into a plot and holding drains resources into it until it pops into existence.

Serves: Satisfying Progression (a standalone prize category), legibility, and growth-at-a-glance.

### 6.2 Walk-in upgrade pads — zero menus

There are **no shop screens anywhere in the game**. Every interaction is: move there, stand there, watch it fill. A ring gauge fills while standing; stepping off pauses it without losing progress.

Serves: Playability (25%). It means the joystick is the only control we ever have to teach.

### 6.3 Stretch goal (not committed): Dawn draft

Each dawn, three buff cards slide up — Warm Coat, Sharp Axe, Pack Leader, Ice Pick — pick one. Roughly half a day of work and the main reason two runs would play differently. **Deferred.** Revisit at day 11 only if the schedule is ahead.

---

## 7. Escalation and end states

- Night length grows each cycle; the ambient cold floor drops, so the furnace burns faster.
- Nights 1–3: wolves, single gate.
- Night 4: **bear** — tanky, ignores light, walls only slow it.
- Night 6: packs split across two gates simultaneously.
- Night 7: **Whiteout** — all three gates at once, and the ring shrinks passively regardless of fuel.

**Win:** survive night 7.
**Lose:** furnace reaches zero heat. The ring collapses inward to nothing and the screen goes white.
**Reset:** single restart button on both end states. No meta-progression carries over.

---

## 8. Controls

Complete input surface:

- **Virtual joystick**, lower-left, draggable from anywhere in the lower-left region.
- **Tap a gate** to rally the guard squad there.
- **Tap a survivor, then tap a post** to assign them to Gather or Guard.

Nothing else. No buttons, no menus, no pause-and-plan screens.

---

## 9. Feedback and legibility

Legibility is the one visual property that is scored. Priorities:

- Furnace flame height maps directly to fuel remaining.
- The heat ring pulses and visibly creeps inward when losing — the player never needs to read a number to know they are dying.
- Snow visibly overtakes buildings that fall outside the shrinking ring.
- Emoji bubbles over survivors: working / cold / wolf-nearby.
- Screenshake plus a low crack on wall break.
- Floating number popups on every deposit.
- Four resource counters in a single top-right column, portrait-safe.

---

## 10. Technical constraints

Hard requirements from the competition packaging rules:

- Single `.zip`, **35MB max**, `index.html` at the **top level** of the zip, not inside a folder.
- **All game code in `index.html`**, readable and unminified. Develop across multiple source files, concatenate at build time.
- Third-party libraries (Three.js) in a **`vendor/`** folder, referenced by relative path. Never embedded in `index.html`.
- All assets shipped in the zip, relative paths only.
- **Zero external network requests at runtime.** A single CDN reference fails validation.
- Portrait orientation, never rotates. Single-player.

Implementation decisions:

- **All geometry procedural low-poly** — boxes, cones, cylinders, flat colors. No model files in the committed scope.
- **WebAudio-synthesized SFX**, no audio files.
- Target zip size under 2MB against the 35MB cap.
- Must be tested offline from a local static server before submission.

---

## 11. Generative AI usage

AI use is **mandatory**: the rules state the prototype must be built using AI tools (prompt-built), with a build log submitted alongside the entry.

AI-generated assets are permitted. The rules require only that the entrant holds rights to all content. Constraints we impose on ourselves:

1. Image generation runs at **build time only**. No runtime API calls, ever.
2. All generated images ship inside the zip with relative paths.
3. **Never prompt for or reproduce an existing game's IP** — the rules state the prototype may not replicate an existing game. No reference-game names in prompts, no lookalike logos, UI, or characters.
4. Hard byte budget on generated PNGs; downscale everything.

Planned AI asset use, in priority order:

1. Four HUD resource icons (highest legibility value, smallest cost)
2. Sky gradient and title screen art
3. Tileable ground, snow, and wood textures for the low-poly meshes
4. *Stretch only:* concept sheets feeding image-to-3D for two or three hero models

---

## 12. Schedule (18 days)

| Days | Milestone |
|---|---|
| 1–2 | Playable slice: joystick, terrain, trees, carry-stack, furnace deposit, heat ring |
| 3–5 | Day/night cycle, wolves, three gates, guard squad, rally tap |
| 6–8 | Four-resource economy, ghost-build plots, walk-in pads, rescue and survivor assignment |
| 9–11 | Escalation curve, bear, whiteout finale, win/lose, tally, restart |
| 12–14 | **Tuning pass** — where the score is actually won |
| 15–16 | Legibility pass, AI-generated icons and textures, mobile perf, portrait safe areas |
| 17 | Package, offline validation, Design Intent Document |
| 18 | Buffer |

**Build log written daily from day 1.** Required by the rules, and it must demonstrate that AI did the heavy lifting.

---

## 13. Deliverables

1. **Playable prototype build** — `.zip`, 35MB max, structured per section 10.
2. **Design Intent Document** — `.docx`, 500 words max, text only, **no identifying information**.
3. **Build Log** — `.md`, maintained daily. Required but not scored.

All text in English.

---

## 14. Open questions

None blocking. Eligibility confirmed — MHCP membership predates 2026-08-10.
