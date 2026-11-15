# Unrecalled: art and asset credits

Every asset that ships with the game, where it comes from and its licence. All of them allow commercial use inside a game.

| Asset | Source | Licence |
| --- | --- | --- |
| Alegreya Sans font | Juan Pablo del Peral (Huerta Tipográfica), via `@fontsource/alegreya-sans` | SIL Open Font License 1.1 |
| The salvager (hero) | Quaternius, [Ultimate Animated Character Pack](https://opengameart.org/content/animated-characters-pack) | CC0 1.0 |
| The salvager's run | Quaternius, [Universal Animation Library, Standard](https://opengameart.org/content/universal-animation-library) | CC0 1.0 |
| The Order Engine | Quaternius, [Animated Mech Pack](https://opengameart.org/content/animated-mech-pack) | CC0 1.0 |
| Crawlers, loaders and sentries; chairs, crates, barrels, lockers, shelves and desks | Quaternius, [Sci-Fi Essentials Kit](https://opengameart.org/content/sci-fi-essentials-kit) | CC0 1.0 |
| Walls, floor plates, door frames, pipe columns, the cradle, computers, wall lamps and smelting tanks | Quaternius, [Modular Sci-Fi MegaKit, Standard](https://opengameart.org/content/modular-sci-fi-megakit) | CC0 1.0 |

The models in `models/` are built from those packs by `tools/assets/build-models.sh` using `models.json`, which pins each pack's commit or zip checksum and lists the parts, animations and texture sizes kept. FBX models are converted to glTF with Blender first, which also retargets animations borrowed from another rig.

There are no sounds yet.
