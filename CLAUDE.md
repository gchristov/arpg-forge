# arpg-forge

One shared engine for small isometric action RPGs (tap or click to move, real-time combat, a hub plus dungeons, loot, levels, bosses), plus a folder per game.

The roadmap and the engine's design live in Notion: the [Roadmap](https://app.notion.com/p/418662113da8813dafd0f41bae11f782) page under the ARPG Forge project. It's the source of truth for the order of work, the architecture, the shipping plan and what a game provides. Read it before starting a stage, and update it when the plan changes. Don't add plans or business notes to the repo.

## Current state

Stage 1 of the roadmap is under way: build the engine and rebuild Ashen Hollow on it in 3D with Three.js, matching `prototypes/ashen-hollow.html` item for item as listed in `games/ashen-hollow/PARITY.md`. The engine core and world, the 3D village and interiors (`/games/ashen-hollow/`, with `#tavern`, `#crypt` and so on to start in a level), the browser smoke test and the simulation skeleton (`engine/sim/step.ts`: input as commands, events, portals and fades), and combat and enemies with the prototype's HUD are merged. Next is story and interaction: NPCs, dialogue, quests, vendors, the chest, drops and pickups. The prototype (dense one-liners, globals `G` and `P`, `Math.random()` throughout, drawn with Canvas 2D) stays frozen as the spec. Tick `PARITY.md` items as they land. When all are ticked, `/ashen-hollow/` switches to the engine version, and the prototype and `PARITY.md` are deleted. Update this section as the work lands.

## Layout

- `engine/core` maths, seeded random generator, fixed-rate loop. `engine/world` tile maps, levels, collision, pathfinding, line of sight. `engine/sim` the rules. These three are pure: no browser, Three.js or clock (`tests/architecture.test.ts` enforces it).
- `engine/render` Three.js scene and the `Look` interface a game implements; `engine/input` pointer, keys and gamepad.
- `games/<name>/` a game: `levels/`, `content/`, `art/`, `main.ts` and `index.html`.
- `tools/<name>/` Docker-based tools; `tests/` architecture and parity tests; `scripts/` repo settings.

## Commands

Local tools run in Docker, not on this machine: don't install Node, npm packages or other tools on the host unless there's no way around it. Node 26 (`.nvmrc`, `tools/node/Dockerfile`) runs through `./tools/node/run.sh <command>`, which keeps `node_modules` in a Docker volume. Run `./tools/node/run.sh npm install` once.

- Dev server: `./tools/node/run.sh npm run dev`, then open http://localhost:5173. Phones on the same network can use this machine's address. The root page links to each game and prototype. The engine build of Ashen Hollow is at `/games/ashen-hollow/` until it replaces the prototype at `/ashen-hollow/`. Add `?debug` to a game's URL for frame timings.
- Unit tests: `./tools/node/run.sh npm test` (includes headless scenario tests such as `games/ashen-hollow/scenarios.test.ts`, which play the rules with scripted commands) (`npm run test:watch` to re-run on change). Tests sit next to the code as `*.test.ts`, or in `tests/`.
- Type check: `./tools/node/run.sh npm run typecheck`
- Build: `./tools/node/run.sh npm run build` writes `dist/`; `./tools/node/run.sh npm run preview` serves it on http://localhost:4173. Prototypes are copied byte for byte, not bundled.
- Browser smoke test: `./tools/browser/run.sh smoke` loads every page of the build in headless Chromium with WebGL at desktop and phone size. It fails on any page error, checks that a tap moves the hero in each engine game, and saves screenshots to `tools/browser/out/`. Add new pages to `PAGES` in `tools/browser/smoke.mjs`.
- Screenshots: `./tools/browser/run.sh screenshot <page path> [out.png] [width] [height] [script]` saves one page, e.g. `./tools/browser/run.sh screenshot /games/ashen-hollow/ tools/browser/out/phone.png 390 844`. The optional script runs in the page first, for example to dispatch taps. Use it to look at rendering changes.
- A new tool gets its own `tools/<name>/` folder with a `Dockerfile` and a `run.sh` in the same style.

## CI/CD

`.github/workflows/staging-check.yml` runs on PRs into `main` and on pushes to `main`, built from composite actions in `.github/actions/`. Three jobs are required checks: `unit-test` (Vitest, with a `unit-test-results` report), `build-web` (type check and build) and `test-web` (`./tools/browser/run.sh smoke` on the build, with screenshots uploaded as an artifact). On `main`, `deploy-web-staging` publishes the build to GitHub Pages at https://gchristov.github.io/arpg-forge/, so the latest version can be played on a phone. Each game has its own path (`/ashen-hollow/`), which serves the game's prototype until the game has an engine entry under `games/<name>`. Prototypes are also kept at `/prototypes/<name>.html` for comparison.

## Rules

- **Stay quiet for now.** No README, repo description, website or topics. The repo's settings script keeps them empty.

- **Engine versus game.** `engine/` owns how the game plays. `games/<name>/` owns what it is: setting, story, levels, enemies, items, art, sound, HUD skin. The engine contains no game-specific names, text, colours or coordinates.
- **Share by default, extend when needed.** Express a new game's needs as data through engine registries first. A mechanic only one game needs goes in that game's `extensions/` folder, plugged in through extension points (registries, systems, event hooks, named overrides), and is listed in that game's `EXTENSIONS.md`. It moves into `engine/` only when a second game wants it. If an extension needs engine internals, add an extension point rather than moving the mechanic into the engine.
- **Neutral engine words.** Use "melee skill", "resource", "healing item" and "vendor" in the engine; games give them their names.
- **Rules separate from presentation.** Game rules run in `step(state, input, dt)` at a fixed rate with a seeded random generator, and emit events. Rendering, audio and HUD only listen; they never change the state. Dependencies point inwards (core, then simulation, then presentation and platform): `engine/core`, `engine/world` and `engine/sim` never import the browser, Three.js or a clock.
- **Mind the frame budget.** 16.6 ms a frame. Avoid allocating in per-frame code (pool particles and projectiles), cull what's off screen, and load assets before a level starts, never mid-play. Measure with the debug overlay before optimising.
- **Art from licensed packs.** Use 3D asset packs whose licence allows commercial use inside a game, and record each one's source and licence in the game's `art/CREDITS.md`.
- **Refactors keep behaviour.** When restructuring, the game must play exactly as before. Say so explicitly if behaviour changes. A game rebuilt from its prototype keeps the prototype's rules and numbers unless a change is called out.
- **Pilots stay small:** about 30–60 minutes of play. Don't build depth into a game until it shows traction.

## Code quality

The user can't review every line, so the code has to stand on its own: testable, easy to read and following good design, without needing the author to explain it.
- **Testable.** Keep rules in plain functions and in `step`, not in rendering, audio or HUD code. Pass dependencies in (the random generator, `dt`, input) rather than reading globals, `Math.random()`, `Date.now()` or `performance.now()` inside the rules.
- **Readable.** One responsibility per file, named after what it holds, and files small enough to read in one go. Use names from the domain (hero, enemy, room, drop, cooldown) and keep functions small.
- **Clear code over comments.** Let names and structure say what code does. Comment only what the code can't say: why a choice was made, an edge case, a browser quirk. No comments that restate the line below, no section markers, and no doc comments on self-explanatory functions and parameters. No comments that compare with code that will go away ("as in the prototype") or that name a stage, PR or ticket, because they go stale. State the rule itself instead. The same goes for docs (`CLAUDE.md`, READMEs): no ticket IDs and no comparisons with other projects.
- **Consistent.** Follow the patterns already in the codebase before inventing new ones, and say so when a new pattern is needed.
- **Ask before it grows.** When doing it properly needs a change beyond the PR's scope (a refactor of existing code, a new dependency, a new engine extension point, moving logic around after the fact), say what and why and wait for a go rather than folding it in.
- **Review before handing over.** Re-read the whole diff against these points before asking for a review or merge, and list what was checked and what was left.

## Branches and pull requests

- Prefix branch names with the Notion task's ID if it has one, e.g. `tas-123-something-changed` (no brackets, because git doesn't allow them in branch names).
- Prefix PR titles with the same ID in brackets if there is one, e.g. `[TAS-123] Something changed`.
- Commits within a PR don't need the prefix. Each commit message briefly says what changed in that commit, so the work can be picked back up later with quick context.
- PR descriptions follow `.github/PULL_REQUEST_TEMPLATE.md`. Drop sections that don't apply, e.g. Demo and Screenshots for a non-visual change.

Every PR that changes how the game plays, looks or sounds is tried in the browser before it's handed over: play through what changed at desktop size and at phone width with touch, including the cases the change guards. Say in "How is this change tested?" what was checked and what couldn't be. Tests don't replace this. Build-only, docs and tooling changes skip it.

Merging a PR:
- Before merging, review the entire diff (`gh pr diff <n>`) the way a reviewer would, not just the files you remember changing. Look for bugs, for edge cases nobody has raised (low or uneven frame rates, a tab left in the background, touch versus mouse, small screens, saves from an older version) and for anything missing (tests, docs, the Notion task). Fix what you can in the PR and say what you changed. Stop and ask about anything unexpected, anything you can't resolve yourself, or an edge case so unlikely that fixing it is a judgement call.
- Merge only once all checks pass, never while one is pending or failing.
- Always squash merge without a commit description: `gh pr merge <n> --squash --admin --body "" --delete-branch`. `main` requires an approval that a solo repo never gets, so the admin override is expected.
- Afterwards, clean up local git: switch to `main`, pull, and delete the merged local branch.

The repository's GitHub settings (merge options, protection of `main`) live in `scripts/github-settings.sh`. Change them there and re-run the script rather than changing them in the web UI.

## Working with the user

Claude runs the project and owns the business side: which pilots to make, platforms, store pages, pricing, marketing, timelines and spending. Make those calls and say why, rather than asking. The user is an experienced software engineer who is new to games. They guide the engineering, so bring engineering trade-offs to them. They also carry out what needs a human (accounts, payments, identity checks, uploads, posts) when they have time, often in the evening and sometimes not for days. Give a recommendation, not a menu. Batch what needs the user into small, clearly scoped steps, and build lead time into anything with external waiting (Steam account checks, store page timing).

Tasks and status live in the Notion project "ARPG Forge" (Work → Projects). Keep Notion lean: the user reads it.
