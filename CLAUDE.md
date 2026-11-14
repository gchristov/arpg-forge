# arpg-forge

One shared engine for small isometric action RPGs (Diablo-style: tap or click to move, real-time combat, a hub plus dungeons, loot, levels, bosses), plus a folder per game. Each game is a cheap pilot for Steam; the one that catches on gets more work. `PLAN.md` is the source of truth for the architecture and the order of work.

## Current state

Step 0 of `PLAN.md` is done: TypeScript, Vite, Vitest and CI are set up, and `engine/`, `games/`, `tools/` and `tests/` exist but are empty. The whole game is still `prototypes/ashen-hollow.html`, the original one-file prototype of Ashen Hollow (dense one-liners, globals `G` and `P`, `Math.random()` throughout). It stays frozen as the reference to compare against. Next is step 1: pull the engine out into `engine/` and `games/ashen-hollow/`, keeping the game playing exactly the same. Update this section as the steps land.

## Commands

Node 26 (`.nvmrc`). Run `npm install` once.

- Dev server: `npm run dev`, then open the printed URL. The root page links to each game and prototype.
- Unit tests: `npm test` (`npm run test:watch` to re-run on change). Tests sit next to the code as `*.test.ts`, or in `tests/`.
- Type check: `npm run typecheck`
- Build: `npm run build` writes `dist/`; `npm run preview` serves it. Prototypes are copied byte for byte, not bundled.

## CI/CD

`.github/workflows/staging-check.yml` runs on PRs into `main` and on pushes to `main`, built from composite actions in `.github/actions/`: `unit-test` (Vitest, with a `unit-test-results` report) and `build-web` (type check and build) are required checks. On `main`, `deploy-web-staging` publishes the build to GitHub Pages at https://gchristov.github.io/arpg-forge/, so the latest version can be played on a phone.

## Rules

- **Engine versus game.** `engine/` owns how the game plays. `games/<name>/` owns what it is: setting, story, levels, enemies, items, art, sound, HUD skin. The engine contains no game-specific names, text, colours or coordinates.
- **Share by default, extend when needed.** Express a new game's needs as data through engine registries first. A mechanic only one game needs goes in that game's `extensions/` folder, plugged in through extension points (registries, systems, event hooks, named overrides), and is listed in that game's `EXTENSIONS.md`. It moves into `engine/` only when a second game wants it. If an extension needs engine internals, add an extension point rather than moving the mechanic into the engine.
- **Neutral engine words.** Use "melee skill", "resource", "healing item" and "vendor" in the engine; games give them their names.
- **Rules separate from presentation.** Game rules run in `step(state, input, dt)` at a fixed rate with a seeded random generator, and emit events. Rendering, audio and HUD only listen; they never change the state.
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
- Always squash merge without a commit description: `gh pr merge <n> --squash --admin --body "" --delete-branch`. `main` requires an approval that a solo repo never gets, so the admin override is expected.
- Afterwards, clean up local git: switch to `main`, pull, and delete the merged local branch.

The repository's GitHub settings (merge options, protection of `main`) live in `scripts/github-settings.sh`. Change them there and re-run the script rather than changing them in the web UI.

## Working with the user

The user is a first-time game developer and a working parent, and acts as the "execution point" when they have time, often in the evening and sometimes not for days. Claude leads: give a recommendation, not a menu. Batch what needs the user into small, clearly scoped steps, and build lead time into anything with external waiting (Steam account checks, store page timing).

Tasks and status live in the Notion project "ARPG Forge" (Work → Projects). Keep Notion lean: the user reads it.
