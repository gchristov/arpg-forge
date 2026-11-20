import type { NpcType } from '../../../engine/sim/content';
import type { Person } from '../../../engine/story/talk';
import { REPLY, type ReplyId, type StepId } from './quest';
import { SPEAKERS } from './voices';

/** What each person can do for U-7, by kind: the services their buttons buy, by index. */
export const NPCS: Record<string, NpcType> = {
  foreman: { services: [] },
  trader: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 20 }] },
  // Pell keeps whatever U-7 fights with sharp: its hands, then her chainsaw.
  tinker: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

/**
 * What each person says, by kind. Each says the first entry whose condition holds, so the specific ones come first and
 * the one with no condition, said otherwise, comes last. See `engine/story/README.md`.
 */
export const PEOPLE: Record<string, Person<StepId, ReplyId>> = {
  foreman: {
    title: SPEAKERS.foreman,
    leave: 'On my way',
    says: [
      // After the raid, Odell gives U-7 its chance and sends it to Pell for a weapon.
      {
        at: 'raidStopped',
        pages: [
          { text: 'Huh. You really smashed it. I’m Odell; I keep this place running, what’s left of it.' },
          {
            text: 'If the Foundry’s coming for everything, someone has to stop it, and you know the place. But you won’t get far with your bare hands. Pell, in the workshop, might have something.',
            options: [{ label: '“I’ll see Pell.”', reply: REPLY.seePell }],
          },
        ],
      },
      // Out of the crate: where the Foundry's orders are given.
      {
        at: 'crateOpened',
        text: 'You came for me. … When that big machine fell, every machine in here stopped. Now they’re waiting for orders, and the orders come from that terminal.',
        options: [{ label: '“Then I’ll give the order.”', reply: REPLY.giveOrder }],
      },
      // The order cancelled: the machines carry the town's things back, and U-7 takes him home.
      {
        at: 'orderClosed',
        text: 'The machines are bringing everything back. They listen to you now.',
        options: [{ label: '“Come on. Let’s go home.”', reply: REPLY.goHome }],
      },
      { at: 'orderAsked', text: 'The terminal. Tell the machines what to do.' },
      { from: 'codeAsked', text: 'The turbine’s at the logging camp. Switch it back and we’ll have lights again too.' },
      { at: 'sentToMags', text: 'Mags’s back door. If anyone knows a way in, it’s her.' },
      { at: 'sawFound', text: 'That’s Pell’s saw. She’ll want to see it back.' },
      { at: 'sawAsked', text: 'Pell’s saw went into the woods, east of town. Mind yourself out there.' },
      { at: 'sentToPell', text: 'Pell’s workshop is here in town.' },
      { text: 'Go on, then. Prove it.' },
    ],
  },
  trader: {
    title: SPEAKERS.mags,
    services: [
      { label: 'Get patched up', service: 0, tag: 'Free' },
      { label: 'Buy a patch kit', service: 1, tag: '{price} scrap' },
    ],
    says: [
      // Mags's quest: the turbine.
      {
        at: 'sentToMags',
        pages: [
          { text: 'Pell sent you? Yes, my back door leads into the Foundry. But it’s had no power since the machines switched off the turbine.' },
          {
            text: 'The turbine’s at the logging camp, deep in the woods. A loader guards it, and it carries the access code.',
            options: [{ label: '“I’ll switch it back.”', reply: REPLY.switchBack }],
          },
        ],
      },
      // The power back on, and Odell taken.
      {
        at: 'powerOn',
        pages: [
          {
            text: 'Foundry machines came through the moment the power came back, looking for you. When they couldn’t find you, they took Odell instead, through my back door.',
            options: [{ label: '“Then I’m going in.”', reply: REPLY.goIn }],
          },
          { text: 'The door’s open. Bring him home.', options: [{ label: 'On my way' }] },
        ],
      },
      { flag: 'wentDown', text: 'Patched up again. You’re getting expensive.', services: true },
      { from: 'toldByMags', text: 'My back door is open. Bring Odell home.', services: true },
      { from: 'codeAsked', text: 'The turbine’s at the logging camp. Its loader has the code.', services: true },
      { at: 'sawFound', text: 'That’s Pell’s saw. Go and show her.', services: true },
      { at: 'sawAsked', text: 'The woods, with your bare hands? Take a patch kit.', services: true },
      { at: 'sentToPell', text: 'Pell’s workshop is across the square, if that’s who you’re after.', services: true },
      { text: 'A Foundry robot in my shop. Keep your hands where I can see them.', services: true },
    ],
  },
  tinker: {
    title: SPEAKERS.pell,
    services: [
      { label: 'Toughen your hands (+3 damage)', service: 0, tag: '{price} scrap', when: { holding: null } },
      { label: 'Sharpen the chain (+3 damage)', service: 0, tag: '{price} scrap', when: { not: { holding: null } } },
    ],
    says: [
      // Pell's quest: her chainsaw.
      {
        at: 'sentToPell',
        pages: [
          { text: 'A Foundry robot in my workshop. Odell sent you? … You need a weapon. The only real one we had was my chainsaw, and a machine took it to the woods last week.' },
          { text: 'Get it back and it’s yours. The woods are east of town.', options: [{ label: '“I’ll get it back.”', reply: REPLY.getSaw }] },
        ],
      },
      {
        at: 'sawFound',
        text: 'You actually got it back. Keep it; it’ll do more good in your hands than mine. … The way into the Foundry is Mags’s shop. It was the Foundry’s depot, and her back door goes straight in.',
        options: [{ label: '“I’ll talk to Mags.”', reply: REPLY.seeMags }],
      },
      { until: 'sentToPell', text: 'A Foundry robot in my workshop? Talk to Odell by the fire first.' },
      { from: 'toldByMags', text: 'The machines took Odell? Then go. And keep that chain running.', services: true },
      { at: 'powerOn', text: 'The lights are back. Go and tell Mags.', services: true },
      { from: 'codeAsked', text: 'The logging camp is past where you found my saw, deeper in the woods.', services: true },
      { at: 'sentToMags', text: 'Mags’s trading post is across the square.', services: true },
      { text: 'It went east into the woods. Your hands will do for it.', services: true },
    ],
  },
};
