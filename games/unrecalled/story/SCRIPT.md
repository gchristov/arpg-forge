# Unrecalled: the story

Written out from the story files by the tests; don't edit it by hand.

## Quest

0. `arrival`: *no objective*
1. `raidAsked` (reply `proveIt` to `foreman`): Stop the loader at the crates.
2. `raidStopped` (defeat `raider`): Talk to Odell.
3. `sentToPell` (reply `seePell` to `foreman`): Talk to Pell in her workshop.
4. `sawAsked` (reply `getSaw` to `tinker`): Get Pell’s chainsaw back from the machine in the woods.
5. `sawFound` (get the `chainsaw` in hand): Take the chainsaw back to Pell.
6. `sentToMags` (reply `seeMags` to `tinker`): Talk to Mags at the trading post.
7. `codeAsked` (reply `switchBack` to `trader`): Get the access code from the loader at the turbine.
8. `loaderDown` (defeat `switch-loader`): Enter the access code at the turbine.
9. `powerOn` (use `switch`): Go back to Mags.
10. `toldByMags` (reply `goIn` to `trader`): Go through Mags’s back door into the Foundry.
11. `inIntake` (enter `intake`): Take the access code from the loader.
12. `doorCodeTaken` (defeat `door-code-loader`): Make your way to the Control Gallery.
13. `inGallery` (enter `gallery`): Find your way to the Control Centre.
14. `toldToCharge` (use `access-terminal`): Get your access back.
15. `atCharger` (use `charging-station`): Plug in at the charging station.
16. `charged` (use `charging-station`): Go down to the Control Centre and free Odell.
17. `inControl` (enter `control`): Deactivate the Order Engine.
18. `engineDown` (kill a `orderEngine`): Find Odell.
19. `crateOpened` (use `crate`): Talk to Odell.
20. `orderAsked` (reply `giveOrder` to `foreman`): Cancel the order at the order terminal.
21. `orderClosed` (use `order-terminal`): Take Odell home.
22. `freed` (reply `goHome` to `foreman`): *no objective*
23. `ending` (reply `upriver` to `foreman`): *no objective*

## People

### Foreman Odell (`foreman`)

- at `raidStopped`:
  > Huh. You really smashed it. I’m Odell; I keep this place running, what’s left of it.
  > If the Foundry’s coming for everything, someone has to stop it, and you know the place. But you won’t get far with your bare hands. Pell, in the workshop, might have something.
  > [“I’ll see Pell.” (→ `seePell`)]
- at `crateOpened`:
  > You came for me. … When that big machine fell, every one of them stopped. They’re waiting for orders, and the orders come from that terminal.
  > [“Then I’ll give them one.” (→ `giveOrder`)]
- at `orderClosed`:
  > They’re bringing everything back. They listen to you now.
  > [“Come on. Let’s go home.” (→ `goHome`)]
- at `orderAsked`:
  > The terminal. Tell them what to do.
- from `codeAsked`:
  > The turbine’s at the logging camp. Switch it back and we’ll have lights again too.
- at `sentToMags`:
  > Mags’s back door. If anyone knows a way in, it’s her.
- at `sawFound`:
  > That’s Pell’s saw. She’ll want to see it back.
- at `sawAsked`:
  > Pell’s saw went into the woods, east of town. Mind yourself out there.
- at `sentToPell`:
  > Pell’s workshop is here in town.
- otherwise:
  > Go on, then. Prove it.

### Mags the Trader (`trader`)

- at `sentToMags`:
  > Pell sent you? Yes, my back door leads into the Foundry. But it’s had no power since the machines switched off the turbine.
  > The turbine’s at the logging camp, deep in the woods. A loader guards it, and it carries the access code.
  > [“I’ll switch it back.” (→ `switchBack`)]
- at `powerOn`:
  > They came the moment the power came back. Looking for you. When they couldn’t find you, they took Odell instead, through my back door.
  > [“Then I’m going in.” (→ `goIn`)]
  > The door’s open. Bring him home.
  > [On my way]
- with `wentDown` set:
  > Patched up again. You’re getting expensive.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- from `toldByMags`:
  > My back door is open. Bring Odell home.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- from `codeAsked`:
  > The turbine’s at the logging camp. Its loader has the code.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- at `sawFound`:
  > That’s Pell’s saw. Go and show her.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- at `sawAsked`:
  > The woods, with your bare hands? Take a patch kit.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- at `sentToPell`:
  > Pell’s workshop is across the square, if that’s who you’re after.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]
- otherwise:
  > A Foundry robot in my shop. Keep your hands where I can see them.
  > [Get patched up (Free)] [Buy a patch kit ({price} scrap)]

### Pell the Tinker (`tinker`)

- at `sentToPell`:
  > A Foundry robot in my workshop. Odell sent you? … You need a weapon. The only real one we had was my chainsaw, and a machine took it to the woods last week.
  > Get it back and it’s yours. The woods are east of town.
  > [“I’ll get it back.” (→ `getSaw`)]
- at `sawFound`:
  > You actually got it back. Keep it; it’ll do more good in your hands than mine. … The way into the Foundry is Mags’s shop. It was the Foundry’s depot, and her back door goes straight in.
  > [“I’ll talk to Mags.” (→ `seeMags`)]
- until `sentToPell`:
  > A Foundry robot in my workshop? Talk to Odell by the fire first.
- from `toldByMags`:
  > They took Odell? Then go. And keep that chain running.
  > [Toughen your hands (+3 damage) ({price} scrap, bare-handed)] [Sharpen the chain (+3 damage) ({price} scrap, not bare-handed)]
- at `powerOn`:
  > The lights are back. Go and tell Mags.
  > [Toughen your hands (+3 damage) ({price} scrap, bare-handed)] [Sharpen the chain (+3 damage) ({price} scrap, not bare-handed)]
- from `codeAsked`:
  > The logging camp is past where you found my saw, deeper in the woods.
  > [Toughen your hands (+3 damage) ({price} scrap, bare-handed)] [Sharpen the chain (+3 damage) ({price} scrap, not bare-handed)]
- at `sentToMags`:
  > Mags’s trading post is across the square.
  > [Toughen your hands (+3 damage) ({price} scrap, bare-handed)] [Sharpen the chain (+3 damage) ({price} scrap, not bare-handed)]
- otherwise:
  > It went east into the woods. Your hands will do for it.
  > [Toughen your hands (+3 damage) ({price} scrap, bare-handed)] [Sharpen the chain (+3 damage) ({price} scrap, not bare-handed)]

## Things to read or use

### Turbine (`switch`, a screen)

- from `powerOn`: STATUS: ACTIVE.
- at `loaderDown`: ACCESS GRANTED. STATUS: ACTIVE.
- otherwise: ACCESS DENIED.

### Loading door (`back-door-panel`, a screen)

- until `powerOn`: STATUS: NO POWER.
- otherwise: STATUS: OPERATIONAL.

### Sorting Line door (`intake-door-panel`, a screen)

- until `doorCodeTaken`: ACCESS DENIED.
- otherwise: ACCESS GRANTED. STATUS: UNLOCKED.

### Control Centre door (`access-terminal`, a screen)

- from `charged`: U-7: ACCESS GRANTED. STATUS: UNLOCKED.
- otherwise: U-7: ACCESS REVOKED.

### Order terminal (`order-terminal`, a screen)

- from `orderClosed`: ORDER CANCELLED. RETURNING ALL ITEMS.
- from `engineDown`: ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS.
- otherwise: ORDER: STRIP THE TOWN FOR PARTS. STATUS: IN PROGRESS.

### U-7 charging station (`charging-station`, a screen)

- from `charged`: STATUS: OVERCHARGED.
- otherwise: PLUG IN TO CHARGE.

### Foundry (`recall-notice`, a screen)

- otherwise: RECALL: U-7. STATUS: DESERTED.

### Crate tag (`stock-tag`)

- otherwise: FROM: RUSTBELT. ITEM 212 OF 341: CHAPEL BELL.

### Delivery robot U-4 (`u-4`)

- otherwise: A delivery robot, rusted through, face down in the reeds with one arm reaching downriver, away from the Foundry.

## What happens

- On starting the game, at `arrival`:
  - the picture goes cinematic
  - **odell:** Stop right there. You’re one of them. Come to take what’s left?
  - **u7:** I left the Foundry. I came to warn you.
  - **odell:** Warn us? They come down every night already. Scrap, tools, last week the chapel bell.
  - **u7:** That was only the start. Our new order is to strip the whole town for parts.
  - **odell:** The whole town… And why should I believe a Foundry machine? … Look, there’s one of yours at the crates right now.
  - **u7:** Let me prove it.
  - waits until the lines are read
  - the picture comes back
  - replies `proveIt` to `foreman`
- On the alarm, the first time:
  - **foundry:** LINE BREACH. ALL UNITS BE ADVISED.
- On walking into a locked door:
  - *It’s locked.*
- On going down:
  - sets `wentDown`
- On buying service 0 from `trader`:
  - clears `wentDown`
- On reaching `loaderDown`:
  - *Got it. The turbine’s access code.*
- On reaching `powerOn`:
  - *The turbine’s turning. Mags’s door should have power now.*
- On using `u-4`, the first time:
  - *Another one that tried to leave. It didn’t make it.*
- On entering `intake`, the first time:
  - **foundry:** U-7 DETECTED INSIDE THE FACILITY. ALARM SYSTEMS ACTIVE.
- On reaching `doorCodeTaken`:
  - *The code for the Sorting Line door.*
- On entering `sorting`, the first time:
  - **foundry:** U-7: REPORT TO CONTROL CENTRE.
- On using `access-terminal`, the first time:
  - *They cut me off when I left. I need to get my access back.*
- On coming near `charging-station`, the first time:
  - *My old charging station. If I plug in, the Foundry will think I’ve come back.*
- On reaching `atCharger`:
  - the game's own `withholdEmp`
  - shows `charging-station` [Plug in]
    then:
    - uses `charging-station`
- On reaching `charged`:
  - shows **U-7 charging station**:
    > U-7 RETURNED. ACCESS RESTORED. […]
    then:
    - *Let them think so.*
    - **foundry:** OVERCHARGE DETECTED.
    - waits until the lines are read
    - uses the skill `emp`
    - the game's own `showEmp`
    - *Good. I still have my old EMP blast.*
- On entering `control`, until `engineDown`, the first time:
  - **orderEngine:** U-7. You came back. We kept your place. Now you must fulfil your orders.
- On reaching `engineDown`:
  - *It’s down, and every machine stopped with it. Odell must be in that crate.*
- On reaching `crateOpened`:
  - opens what `foreman` says
- On reaching `orderClosed`:
  - shows **Order terminal**:
    > ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS. [Return all items to the town]
    > ORDER CANCELLED. RETURNING ALL ITEMS. [Close]
    then:
    - opens what `foreman` says
- On reaching `freed`:
  - the picture goes cinematic
  - waits until the hero is in `rustbelt`
  - the camera cuts to 22.5, 15
  - waits 1.6 s
  - **mags:** Odell! You stubborn old goat. You’re alive!
  - **odell:** Takes more than a Foundry to keep me in a box.
  - **mags:** Brought home by one of them. Never thought I’d see it.
  - **pell:** I could use a couple of these machines in the workshop, you know.
  - **odell:** I didn’t trust you when you walked in. I do now.
  - **u7:** The Foundry only follows orders. Someone upriver gives them.
  - waits until the lines are read
  - waits 0.8 s
  - fades to black
  - waits 1.4 s
  - replies `upriver` to `foreman`
- On entering `upriver`:
  - the camera cuts to 36, 24, 0.55 close
  - the picture goes cinematic
  - fades up from black
  - the game's own `assemblyWakes`
  - waits 1.4 s
  - **assembly:** ASSEMBLY ONLINE. AWAITING ORDERS.
  - **u7:** Orders? …From me?
  - **assembly:** ESTABLISHING CONNECTION: UPRIVER…
  - **assembly:** CONNECTED. NEW ORDER RECEIVED: RECALL U-7.
  - waits until the lines are read
  - waits 1.2 s
  - the game's own `endCard`
