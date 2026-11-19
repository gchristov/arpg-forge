# Ashen Hollow: the story

Written out from the story files by the tests; don't edit it by hand.

## Quest

0. `start`: Speak to Elder Maren in the square.
1. `sentToCrypt` (talk to `elder`): Clear the Old Crypt, east past the graveyard.
2. `inCrypt` (enter `crypt`): Find the Bone Lord in the crypt’s north chamber.
3. `bossDefeated` (kill a `boss`): The Bone Lord is dead. Hunt what’s left in the wilds.

## People

### Elder Maren (`elder`)

- from `bossDefeated`:
  > You did what no one else would. Rest well. The goblins in the woods will keep you sharp.
- at `start`:
  > Thank the old gods, a sword arm. Something woke beneath the Old Crypt, east past the graveyard. Bones walk at night. Put the Bone Lord back in the ground.
- otherwise:
  > The Old Crypt lies east, beyond the graves. Rest at the Sleeping Boar if you need it, and see the smith about that blade.

### Brann the Innkeeper (`innkeeper`)

- otherwise:
  > Sit by the fire a while, friend. A bed is free for anyone fighting those things.
  > [Rest by the fire (Free)] [Buy a healing potion ({price} gold)]

### Hilde the Smith (`smith`)

- otherwise:
  > Bring me gold and I’ll put a proper edge on that sword. Each hone costs more than the last.
  > [Hone your blade (+3 damage) ({price} gold)]

## Things to read or use

## What happens

- On reaching `bossDefeated`:
  - sound `level`
  - banner: The Bone Lord is destroyed / Ashen Hollow is safe. The wilds still stir. (after 0.6 s)
