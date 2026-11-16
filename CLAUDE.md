# arpg-forge

One shared engine for small isometric action RPGs (tap or click to move, real-time combat, a hub plus dungeons, loot, levels, bosses), plus a folder per game.

The roadmap and the engine's design live in Notion: the [Roadmap](https://app.notion.com/p/418662113da8813dafd0f41bae11f782) page under the ARPG Forge project. It's the source of truth for the order of work, the architecture, the shipping plan and what a game provides. Read it before starting a stage, and update it when the plan changes. Don't add plans or business notes to the repo.

## Current state

Stage 1 of the roadmap is done: the engine is built, and Ashen Hollow runs on it in 3D (KayKit models, Three.js) at `/ashen-hollow/`, matching the original one-file prototype's mechanics, story and levels. The prototype is deleted; the git tag `prototype-ashen-hollow` keeps it. Stage 2, making content data, is under way. Done: the engine's `Game` runs the loop, input and drawing; the hero's skills are data (`HeroRules.skills`); rooms are text rows plus a key (`engine/sim/rooms.ts`); `checkContent` checks any game's content. Left: enemy behaviour from reusable states, and generated outdoor maps (put off until a game needs varied maps). The first new pilot, Unrecalled (`games/unrecalled/`, at `/unrecalled/`), is being built: the town of Rustbelt with its buildings and the Foundry's four floors down to its boss, with the whole story from the foreman's job to the ending. The salvager fights with a chainsaw that cuts continuously and an EMP; `#arena` is a practice arena for tuning combat, with machines that keep coming. Update this section as the work lands.

## Layout

- `engine/core` maths, seeded random generator, fixed-rate loop. `engine/world` tile maps, levels, collision, pathfinding, line of sight. `engine/sim` the rules. These three are pure: no browser, Three.js or clock (`tests/architecture.test.ts` enforces it).
- `engine/render` Three.js scene and the `Look` interface a game implements; `engine/input` pointer, keys and gamepad.
- `engine/game` runs a game: `Game` owns the fixed-rate loop, turns taps, held pointers and keys into commands, draws the state and shows the rules' events in the world (animations, markers, flashes, explosions, moving between levels). A game's `main.ts` creates a `Game` from its content, look and models, and adds what it names or words through `GameHooks`: sounds, text, banners, dialogue and its HUD.
- `games/<name>/` a game: `levels/`, `content/`, `art/`, `main.ts` and `index.html`.
- `tools/<name>/` Docker-based tools; `tests/` architecture tests; `scripts/` repo settings.

## Commands

Local tools run in Docker, not on this machine: don't install Node, npm packages or other tools on the host unless there's no way around it. Node 26 (`.nvmrc`, `tools/node/Dockerfile`) runs through `./tools/node/run.sh <command>`, which keeps `node_modules` in a Docker volume. Run `./tools/node/run.sh npm install` once.

- Dev server: `./tools/node/run.sh npm run dev`, then open http://localhost:5173. Phones on the same network can use this machine's address. The root page links to each game. A game's short address (`/ashen-hollow/`) redirects to its build folder (`/games/ashen-hollow/`), set in `vite.config.ts`. Add `#crypt` and the like to start in a level, and `?debug` for frame timings, draw calls and `window.game` (`state`, `send(command)`, `start()`) for scripted browser checks; `?debug&lights=N` scatters N extra lights to check lighting cost. `?debug&resolution=N` draws N pixels per screen point (1 is a quarter of a typical phone's 2), to check whether a device is limited by filling pixels. The overlay also logs the last few slow frames with where their time went and the events just before them.
- Unit tests: `./tools/node/run.sh npm test` (includes headless scenario tests such as `games/ashen-hollow/scenarios.test.ts`, which play the rules with scripted commands) (`npm run test:watch` to re-run on change). Tests sit next to the code as `*.test.ts`, or in `tests/`.
- Type check: `./tools/node/run.sh npm run typecheck`
- Build: `./tools/node/run.sh npm run build` writes `dist/`; `./tools/node/run.sh npm run preview` serves it on http://localhost:4173. Prototypes are copied byte for byte, not bundled.
- Browser smoke test: `./tools/browser/run.sh smoke` loads every page of the build in headless Chromium with WebGL, desktop and phone sizes side by side. It fails on any page error, and on game pages checks through `?debug`'s `window.game` that the models load, the title starts the game and a tap moves the hero. It saves one screenshot per page to `tools/browser/out/`. Add new pages to `PAGES` in `tools/browser/smoke.mjs`. Locally it runs Playwright's Chromium in Docker; CI's `test-web` drives the runner's own Google Chrome instead, which saves building the image (keep the Playwright versions in `tools/browser/Dockerfile` and `.github/actions/test-web/action.yml` the same).
- Screenshots: `./tools/browser/run.sh screenshot <page path> [out.png] [width] [height] [script]` saves one page, e.g. `./tools/browser/run.sh screenshot /games/ashen-hollow/ tools/browser/out/phone.png 390 844`. The optional script runs in the page first, for example to dispatch taps. Use it to look at rendering changes.
- Performance on a real GPU: `./tools/browser/gpu.sh <page URL> <seconds> [query]...` measures a page on this Mac's GPU, which the Docker browser can't use. It starts a separate headless Chrome with a throwaway profile, prints the `?debug` overlay (fps, frame times, draw calls, triangles) for each query, saves screenshots to `tools/browser/out/gpu-*.png`, and stops only that Chrome; the user's own Chrome is never touched. Point it at a PR preview or at a local `npm run preview` (http://localhost:4173/...). Use it for any change that could affect performance, and compare draw calls and draw time before and after. To find where CPU time goes, `MEASURE_SCRIPT=tools/browser/profile.mjs ./tools/browser/gpu.sh <page URL> <seconds> <slowdown> <query>...` profiles a build made with `npx vite build --minify false`, with the CPU slowed to roughly phone speed (a slowdown of 4).
- 3D models: `./tools/assets/build-models.sh games/<name>/art/models.json` downloads each model from its pack's pinned commit (or a zip pinned by its checksum, for packs only published as zips), keeps only the listed parts and animations, shrinks or recolours textures and decimates models where asked, compresses it (meshopt) and writes `games/<name>/art/models/*.glb`, which are committed. Models only published as FBX are converted to glTF first with Blender in Docker (`tools/blender/`); the Blender image is large (about 1.3 GB) and only built when a manifest has FBX models. An FBX model can `borrow` animations its pack lacks from another pack's rig, retargeted by `tools/blender/retarget.py` through a bone map in the manifest; check the result by eye, since rigs that differ a lot retarget badly. Add a model by adding it to `models.json`, rebuilding, and crediting its pack in `art/CREDITS.md`.
- A new tool gets its own `tools/<name>/` folder with a `Dockerfile` and a `run.sh` in the same style.

## CI/CD

`.github/workflows/staging-check.yml` follows Everlog's `staging-check`: it runs on PRs into `main` and pushes to `main`, built from composite actions in `.github/actions/`. Three jobs are required checks: `unit-test` (Vitest, with a `unit-test-results` report), `build-web` (type check and build, the counterpart of `build-android`) and `test-web` (`./tools/browser/run.sh smoke` on the build, the counterpart of `test-android`, with screenshots uploaded as an artifact). `deploy-web-staging` (like `deploy-android-staging`) deploys the build once it's built: a PR to its own preview at `https://gchristov.github.io/arpg-forge/pr-preview/pr-<number>/`, linked from the PR's "View deployment" button (the `preview` environment) and a comment with a QR code for phones; `main` to https://gchristov.github.io/arpg-forge/ (the `github-pages` environment). GitHub Pages serves the `gh-pages` branch, and the `main` deploy never force-pushes or touches `pr-preview/`. Each build carries `build.txt` with its commit, and the deploy waits until the site serves that exact file: GitHub's Pages API reports a build cancelled by a newer push as errored, so it isn't trusted. Each game has a short address such as https://gchristov.github.io/arpg-forge/ashen-hollow/. The repo page's **Deployments** sidebar links the live site and the latest preview.

`.github/workflows/staging-cleanup.yml` removes a PR's preview when the PR closes and marks its deployment inactive. Firebase builds in Everlog need no such cleanup. Everlog's `nightly-check` and `release-check` come when a pilot has a store to publish to. Mention the preview link when handing a PR over for testing.

## Rules

- **Stay quiet for now.** No README, repo description, website or topics. The repo's settings script keeps them empty.

- **Engine versus game.** `engine/` owns how the game plays. `games/<name>/` owns what it is: setting, story, levels, enemies, items, art, sound, HUD skin. The engine contains no game-specific names, text, colours or coordinates.
- **Share by default, extend when needed.** Express a new game's needs as data through engine registries first. A mechanic only one game needs goes in that game's `extensions/` folder, plugged in through extension points (registries, systems, event hooks, named overrides), and is listed in that game's `EXTENSIONS.md`. It moves into `engine/` only when a second game wants it. If an extension needs engine internals, add an extension point rather than moving the mechanic into the engine.
- **Neutral engine words.** Use "melee skill", "resource", "healing item" and "vendor" in the engine; games give them their names.
- **Rules separate from presentation.** Game rules run in `step(state, input, dt)` at a fixed rate with a seeded random generator, and emit events. Rendering, audio and HUD only listen; they never change the state. Dependencies point inwards (core, then simulation, then presentation and platform): `engine/core`, `engine/world` and `engine/sim` never import the browser, Three.js or a clock.
- **Lights go through the light map.** Small lights (lamps, torches, fires, glowing projectiles) are glows in `engine/render/light-map.ts`'s top-down texture, which every lit material reads, so any number costs the same. Only the moon (shadows), the fill light and the hero's light are real Three.js lights; don't add more real lights. New materials for level objects and actors are lit automatically; add moving light with `SceneRenderer.glow`.
- **Mind the frame budget.** 16.6 ms a frame. Avoid allocating in per-frame code (pool particles and projectiles), cull what's off screen, and load assets before a level starts, never mid-play. Measure with the debug overlay before optimising.
- **Art from licensed packs.** Use 3D asset packs whose licence allows commercial use inside a game, and record each one's source and licence in the game's `art/CREDITS.md`.
- **Refactors keep behaviour.** When restructuring, the game must play exactly as before. Say so explicitly if behaviour changes.
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
- Merge with `scripts/merge-pr.sh <n>`. It waits until every required check has appeared and passed, then squash merges without a commit description, using the admin override (`main` requires an approval a solo repo never gets), deletes the branch and updates local `main`. Don't merge with `gh pr merge` directly: right after a push the checks aren't listed yet, and an admin merge would skip them.

The repository's GitHub settings (merge options, protection of `main`) live in `scripts/github-settings.sh`. Change them there and re-run the script rather than changing them in the web UI.

## Testing

Like Everlog: many fast unit tests that check things in isolation, a few scenario tests that play a whole game headless, and a small browser smoke test for what only the real page shows.

- **Unit tests** (`*.test.ts` next to the code) cover rules one at a time: core, world, simulation and the parts of rendering that run without a GPU, such as animation blending (`engine/render/actor-figure.test.ts`). Rules tests build small synthetic arenas with `engine/sim/testing.ts` (`arena`, `run`, `ofType`) and a fixed seed, so outcomes are exact. Most tests belong here.
- **Scenario tests** (`games/<name>/scenarios.test.ts`) play the real game's content headless with scripted commands: the whole quest, clearing a camp, doors, the chest, and the same seed giving the same game. Add one when a change crosses several systems.
- **Content checks** (`engine/sim/content-checks.ts`) find mistakes in a game's content that would only show in play: portals to missing levels, spawns inside walls or cut off from the start, unknown enemy or NPC kinds, quest steps nothing can reach. Each game's `content.test.ts` runs them and checks every actor kind has a built model. Add a check when a new kind of content mistake turns up.
- **Architecture tests** (`tests/architecture.test.ts`) keep the layers apart. Extend them when a new rule about dependencies is agreed.
- **Browser smoke test** (`tools/browser/smoke.mjs`, the `test-web` job) loads every page at desktop and phone size, fails on any page error, taps through the title and checks a tap moves the hero. Keep it to a handful of checks of how everything fits together: the page loads, models load, input reaches the game. Add a check only for wiring the other tests can't reach.
- **Every change to how a game plays comes with tests in the same PR.** A bug fix comes with a test that fails before the fix, such as the animation tests that reproduce the hero walking on after a fight.
- **Not covered automatically:** sound (CI has no audio), phone performance (CI draws in software) and how things look. Check those on the PR's preview page, and say in "How is this change tested?" what was checked and what wasn't.

## Working with the user

Claude runs the project and owns the business side: which pilots to make, platforms, store pages, pricing, marketing, timelines and spending. Make those calls and say why, rather than asking. The user is an experienced software engineer who is new to games. They guide the engineering, so bring engineering trade-offs to them. They also carry out what needs a human (accounts, payments, identity checks, uploads, posts) when they have time, often in the evening and sometimes not for days. Give a recommendation, not a menu. Batch what needs the user into small, clearly scoped steps, and build lead time into anything with external waiting (Steam account checks, store page timing).

Every time something goes to the user to try, include a short testing brief: what to try and how to get there (links, `#level` shortcuts), what feedback is wanted this round (mechanics, story, look, feel or performance, and the specific questions), what is deliberately not done yet so they don't report it, and what's coming next.

Tasks and status live in the Notion project "ARPG Forge" (Work → Projects). Keep Notion lean: the user reads it.
