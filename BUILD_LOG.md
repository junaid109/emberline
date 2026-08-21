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
