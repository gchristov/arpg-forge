# Unrecalled: art and asset credits

Every asset that ships with the game, where it comes from and its licence. All of them allow commercial use inside a game.

| Asset | Source | Licence |
| --- | --- | --- |
| Alegreya Sans font | Juan Pablo del Peral (Huerta Tipográfica), via `@fontsource/alegreya-sans` | SIL Open Font License 1.1 |
| The salvager (hero), and Rustbelt's foreman, trader and tinker | Quaternius, [Ultimate Animated Character Pack](https://opengameart.org/content/animated-characters-pack) | CC0 1.0 |
| The salvager's run | Quaternius, [Universal Animation Library, Standard](https://opengameart.org/content/universal-animation-library) | CC0 1.0 |
| The Order Engine | Quaternius, [Animated Mech Pack](https://opengameart.org/content/animated-mech-pack) | CC0 1.0 |
| Crawlers, loaders and sentries; chairs, salvage caches, the fire barrel, crates, barrels, lockers, shelves and desks | Quaternius, [Sci-Fi Essentials Kit](https://opengameart.org/content/sci-fi-essentials-kit) | CC0 1.0 |
| Rustbelt's dead wind turbine, container stacks and cargo, the workshop's scaffold and truck, the trading post's crane and rooftop cargo, the workshop's solar panels and the pumphouse's pump rig, darkened and dulled to look weathered | Kay Lousberg, [KayKit Space Base Bits](https://kaylousberg.itch.io/space-base-bits) | CC0 1.0 |
| Rustbelt's dead trees, rocks, weeds and pebbles | Quaternius, [Stylized Nature MegaKit, Standard](https://opengameart.org/content/stylized-nature-megakit) | CC0 1.0 |
| Walls, floor plates, door frames, pipe columns, Rustbelt's buildings (weathered) with their railings, its lamp and jetty posts, the depot's stairs, the cradle, computers, wall lamps, alarm beacons and smelting tanks | Quaternius, [Modular Sci-Fi MegaKit, Standard](https://opengameart.org/content/modular-sci-fi-megakit) | CC0 1.0 |

The models in `models/` are built from those packs by `tools/assets/build-models.sh` using `models.json`, which pins each pack's commit or zip checksum and lists the parts, animations and texture sizes kept. FBX models are converted to glTF with Blender first, which also retargets animations borrowed from another rig and decimates the dead trees.

There are no sounds yet.
