# Design Guidance — verbatim reference

Captured 2026-08-26 from
<https://mhcp-game-prototype.devpost.com/details/design-guidance>

This is the authoritative wording, kept in the repo so claims about "what the
rules say" can be checked against the text rather than against memory. Do not
paraphrase it here — quote it. Navigation chrome and the Devpost footer have
been stripped; everything else is as published.

---

## Two design constraints that are fixed

Before you start designing, two constraints shape what you build. They are entry
requirements, not suggestions.

- **Single-player.** Your prototype is played by one person. Multiplayer,
  including asynchronous multiplayer, is out of scope.
- **Portrait orientation.** These are mobile games. Design for a tall,
  phone-shaped screen, and do not change orientation during play.

There are also build requirements covering how your files are packaged. Those
are in *Packaging your build* near the end of this page, and they are worth
reading before you start rather than after you finish.

Everything else on this page is guidance on how to make what you build score
well.

## How to build a winning prototype

You are building a prototype, not a finished game. The goal is a genuinely
playable prototype of your core game, good enough to test with real players.

Get the core experience strong, playable and fun. Everything beyond that is
gravy, and gravy is welcome.

## Start from the core loop, not the features

The single thing judges reward most is a fun, playable core loop (Player
Engagement is 30% of the score, Playability 25%, Core Loop Design 20%). Pick the
one thing your player does over and over, make that satisfying, then build
outward from there.

## Depth is rewarded. Sprawl is not.

Focus is 15% of the score, and it is worth being precise about what that
measures. Focus penalises sprawl and half-built systems, not ambition and not
depth. A deep, complete, well-made game is more focused, not less.

So there is a floor here, not a ceiling. The floor is one core experience that
genuinely works. Once you are past it, going further is rewarded: a prototype
that adds real depth, a longer arc, or a fresh twist on top of a working core
will score higher, because it is more engaging and because Core Loop Design and
Originality both reward it.

The failure mode is not building too much. It is building six things that each
half-work. Depth on a focused core beats breadth that does not hold together.

## Make it genuinely playable

Your prototype must let a player actually play, not click through screens. It
should at minimum have:

- A primary action the player takes.
- A goal, and a win / lose / reset state.
- Real-time feedback so the player knows they are doing well or badly.
- Progression or escalation within a single play session, so the session builds
  instead of repeating one static state. Judges play a single sitting, so
  anything that only unlocks later will not be seen.
- A clear start and end-or-again so it feels like a real session.

## Where not to spend your time

None of the following will earn you score, and each is a common way to lose a
week. Spend the time on your core loop instead.

- **Real-time or asynchronous multiplayer.** Out of scope, and it will not be
  judged.
- **Ragdoll physics and physics-driven vehicles.** Complexity that is not your
  core loop.
- **Detailed creature animation.** Bipedal or abstract characters work fine.
- **Dynamic day and night cycles, and dynamic weather.** A fixed time of day and
  a fixed weather state are completely fine.

These are all fine, and welcome: local leaderboards, sound effects, music,
visual effects, and any amount of art you feel like making, once your core loop
works. Everything has to run offline inside your build.

Not sure whether something is in scope? Ask in the competition channel and we
will answer.

## Visuals: clear first, pretty if you have time

Visual polish is not scored, but that is not the same as telling you to skip it.
Here is the actual bar.

The floor is legibility. A player must be able to tell your game pieces apart,
recognise what each one is, and read the state of the game at a glance. Distinct
shapes, distinct colours, clear states, readable text. Simple art is completely
fine. What does not clear the bar is a screen of undifferentiated boxes where a
judge cannot tell a tower from an enemy, or cannot see that something just
changed.

There is no ceiling. If your core loop is working and you want to make it look
good, do it. Nobody will mark you down for a prototype that also happens to be
beautiful, and visuals that make your design clearer help you on the criteria
that are scored.

The order matters, though: make it clear first, make it fun second, make it
pretty third.

## Building with AI: work in passes and verify constantly

This is an AI-native competition, so build by prompting. Three things creators
consistently learn the hard way:

- The tool will sometimes say it did something it did not do. After each prompt,
  play the build and confirm the change landed and works. Do not trust "done"
  without checking. Catching this early saves you from stacking new prompts on a
  broken base.
- Build in small passes. Get the core loop working first, then add progression,
  then feedback and fixes. Small, verifiable steps are far faster than one giant
  prompt, and they make your build log (a required submission) cleaner and more
  useful.
- Tell your AI the constraints up front. Portrait orientation and a fully
  self-contained build are both things an AI will not do by default. Say so in
  your very first prompt rather than retrofitting them at the end. See
  *Packaging your build* below.
- Want a walkthrough? We have written up "Building Your Prototype with AI", an
  optional approach covering designing with AI, building the core loop first,
  and packaging your submission.

## Test with a real person before you submit

Even one playtest with someone who has never seen your game will surface the
biggest problems: is the goal obvious, does it respond, is it actually fun to
repeat. Fix those and you will out-score a bigger entry that no one has played.

## The genres

Choose one genre at submission. Your prototype is judged against the genre you
pick, so pick the one your game best fits.

Your game needs to clearly be an example of its genre. Each genre below lists
the elements that need to be present. Those are the floor: if a judge cannot
find the tower defense in your tower defense, or the resource management in your
survival game, it will not score well against the others in that lane.

Beyond that floor, hybrids, twists and variations are genuinely welcome and
rewarded. The only thing to avoid is letting the hybrid element crowd out the
genre itself.

### Simulation & Management

**What it is:** repeating invest, harvest, and upgrade loops with visible
growth. The player makes choices, sees the system respond, and optimizes over
time.

**Needs to be present:** a resource or system the player invests in; a system
response the player can read and react to; visible growth or change across the
session.

A core version might look like: a single resource or system the player grows by
making trade-off decisions, with visible feedback on whether each choice helped.
A small aquarium, farm, or shop where you spend to add things, a simple model
reacts, and you push toward a thriving, stable state.

**In portrait:** a tall single scene works well here. Put the thing you are
growing in the upper two thirds and your build or buy menu in a drawer along the
bottom, within thumb reach. A tall aquarium, a stacked set of shop shelves, or a
vertical strip of farm plots all read better on a phone than a wide field does.

A strong prototype here makes the trade-offs clear and the growth visible, and
gives the player a reason to make "just one more" decision. The trap: a huge
economy with dozens of variables the player cannot feel or read. Add depth by
making a few systems interact meaningfully, not by piling on variables.

### Tower Defense & Strategy

**What it is:** defensive systems with unit variety, escalation, and a simple
economy. The player places or manages defenses against waves that get harder.

**Needs to be present:** defenses the player places or manages; threats that
escalate across the session; a spend or upgrade decision that matters.

A core version might look like: one map or lane, a few defender types with
distinct roles, an escalating set of waves, and a currency you earn and spend
between or during waves. The fun is in the placement and upgrade decisions under
rising pressure.

**In portrait:** run your lane vertically. Enemies advance from the top of the
screen toward the thing you are defending at the bottom, with your defender
palette across the base of the screen. This is the standard mobile tower defense
layout and it works better on a phone than a horizontal lane does, so design for
it rather than squeezing a wide map into a tall frame.

A strong prototype here makes each defender feel meaningfully different and each
wave feel like a real decision point. The trap: many unit types that all fulfill
the same role, or tech trees that add complexity without fun. More is welcome if
each defender feels genuinely different: three great ones beat twenty samey
ones.

### Survival & Resource Management

**What it is:** gather, craft, and survive escalating threats. The player
collects resources, converts them into tools, refined resources, or defenses,
and stays alive as pressure ramps.

**Needs to be present:** gathering or collecting resources; converting them into
something more useful through crafting, refining or upgrading; a threat that
escalates and that the player manages against.

A core version might look like: a small loop of gathering one or two resources,
a simple craft, refinement, or upgrade, and an escalating threat (time, hunger,
enemies) the player manages against. The fun is the tension between gathering
and defending.

**In portrait:** this genre suits a phone screen most naturally of the three. A
single tall play area, or one that scrolls vertically, gives you room for status
meters along the top and a crafting or inventory drawer along the bottom without
crowding the action.

A strong prototype here makes the survival pressure legible and the
gather-versus-defend trade-off real. The trap: a sprawling crafting tree or open
world that spreads you thin. Go deeper on a tight loop rather than wider: one
"gather, upgrade, survive" loop with real tension beats a broad one that does
not hold together.

## Packaging your build

Your prototype is submitted as a single .zip, no larger than 35MB. How the files
are arranged matters, so read this before you start building rather than at the
end.

Your .zip should look like this:

```
index.html : your whole game, readable. Must be at the top level of the zip

vendor/ : your libraries. Must be this folder name

everything else : images, audio, fonts, data. Name and organize these however you like
```

Three things to get right:

1. All of your game code goes in index.html. Develop across as many source files
   as you like, then add a build step that assembles them into a single
   index.html before you submit. Your AI can set this up in about a minute, and
   it is worth doing on day one.
2. Do not minify it. Part of the evaluation reads your code, so it has to be
   readable. If your build tool minifies by default, turn that off.
3. Libraries go in vendor, not in index.html. Download Three.js, or anything
   else you use, into a vendor folder and reference it with a relative path.

Your build must be fully self-contained. Every library, font, image, sound and
data file must be inside the .zip and referenced with a relative path. Your
prototype must run with no internet connection at all, and it must not make any
external network request while it is running. Anything loaded from an external
URL, including a content delivery network (CDN), will fail validation.

Three things creators commonly miss:

- **Fonts.** A web font pulled from a font service is an external request.
  Bundle the font file, or use a standard system font.
- **Image services.** Sites like placehold.co or picsum.photos are external
  requests. Generate or draw your art inside the project instead.
- **Rebuilding.** If you change your source files, re-run your build before you
  zip. It is easy to submit a stale index.html.

Test it the way we will run it. Do not just double-click index.html, because
that can pass when your build is still pulling files from the internet, and it
can also fail on a build that is perfectly fine. Instead:

1. Re-run your build.
2. Unzip your submission into a clean folder.
3. Serve it with a local web server. Your AI can start one for you.
4. Open it in a private or incognito window, so nothing is cached.
5. Turn your internet off.
6. Play a full session in portrait. If anything is missing, silent, or the
   screen is black, something is still loading from the internet. Find it and
   bundle it.

## Quick checklist before you submit

**Your game**

- A player can play the core loop, reach a win/lose/reset, and play again.
- There is progression or escalation within a single play session.
- It is single-player, and it runs in portrait without changing orientation.
- The core elements of your chosen genre are clearly present.
- A player can tell your game pieces apart and read what is happening at a
  glance.
- Everything in the build works. Nothing is half-finished or left in as a stub.

**Your build**

- A single .zip, no larger than 35MB, with index.html at the top level and not
  inside a folder.
- All of your game code is in index.html, and it is not minified.
- Your libraries are in a folder called vendor.
- Everything else your game needs is inside the .zip and referenced with a
  relative path.
- You have played it through with the internet off, from a local server, in a
  private window.

**Your artifacts**

- The build (.zip, under 35MB).
- The design-intent doc (.docx, on the template, up to 500 words).
- The build log (.md).

## AI Submission Check (optional)

Here's an optional way to sanity-check your build before you upload. Feel free
to copy and paste the prompt below into your AI tool. It aims to flag anything
likely to get your submission rejected so you can fix it first. It's not
required and it's not part of judging; it's just a helpful extra pass before you
submit.

> Check my submission before I upload it. Look at all the files in my project
> folder (the folder or .zip I've shared with you) and tell me, clearly, whether
> each of these is a PASS or a PROBLEM:
>
> 1. Genre fit. Based on how my game actually plays, which ONE of these three
>    genres does my game best fit, and does it include that genre's core loop?
>    If it doesn't clearly fit any of them, tell me plainly — a prototype that
>    fits none of these will be rejected.
>    - Survival & Resource Management: the player gathers resources, crafts them
>      into tools/defenses, and survives escalating threats.
>    - Simulation & Management: the player repeatedly invests, harvests, and
>      upgrades in a loop with visible growth, optimizing over time.
>    - Tower Defense & Strategy: the player places or manages defenses (with
>      unit variety and a simple economy) against waves that get harder.
> 2. Readable code. Is my index.html readable, unminified source code — NOT a
>    minified/bundled/compiled build or a loader that points to a bundled file?
>    If it's minified or a build output (e.g. Vite, webpack, Unity, or Godot
>    export), flag it and tell me to submit my readable source instead.
> 3. Offline / no external links. Does anything load from the internet — CDN
>    URLs, remote `<script>`/import links, or network calls (fetch,
>    XMLHttpRequest, WebSocket)? List every remote URL you find. Everything must
>    load from inside my folder.
> 4. File structure. Is index.html at the root of the folder, are assets
>    referenced with relative paths, and are all third-party libraries inside a
>    /vendor folder?
> 5. Single-player & portrait. Do you see any multiplayer or networking code? It
>    must be single-player only, in one fixed portrait orientation.
>
> For anything that's a PROBLEM, tell me exactly which file and line, and how to
> fix it.
