import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as nextTurn } from 'node:timers/promises';

async function setup(t, { supported = true, blockResume = false } = {}) {
  const document = new EventTarget();
  let interacting = false;
  let resumeCalls = 0;
  let notes = 0;

  class AudioContext extends EventTarget {
    state = 'suspended';
    currentTime = 0;
    destination = {};

    async resume() {
      resumeCalls++;
      if (!interacting || blockResume) throw new Error('Playback blocked');
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
    }

    createOscillator() {
      return {
        frequency: {},
        connect: target => target,
        start: () => { notes++; },
        stop() {},
        disconnect() {}
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: target => target,
        disconnect() {}
      };
    }
  }

  globalThis.document = document;
  globalThis.window = { document, AudioContext: supported ? AudioContext : undefined };
  const sound = await import(`../src/app/notificationSound.js?test=${encodeURIComponent(t.name)}`);
  const cleanup = sound.prepareNotificationSound();
  t.after(() => {
    cleanup();
    delete globalThis.document;
    delete globalThis.window;
  });

  return {
    play: sound.playNotificationSound,
    gesture(type) {
      const event = new Event(type);
      Object.defineProperty(event, 'isTrusted', { value: true });
      interacting = true;
      try { document.dispatchEvent(event); } finally { interacting = false; }
    },
    get notes() { return notes; },
    get resumeCalls() { return resumeCalls; }
  };
}

test('a visible reminder waits for audio permission and plays once on unlock', async t => {
  const sound = await setup(t);
  const dismiss = sound.play();
  await nextTurn();
  assert.equal(sound.notes, 0);
  sound.gesture('click');
  await nextTurn();
  assert.ok(sound.notes > 0);
  const firstChime = sound.notes;
  sound.gesture('keydown');
  await nextTurn();
  assert.equal(sound.notes, firstChime);
  dismiss();
});

test('a reminder dismissed before the first gesture stays silent', async t => {
  const sound = await setup(t);
  const dismiss = sound.play();
  await nextTurn();
  dismiss();
  const callsBeforeGesture = sound.resumeCalls;
  sound.gesture('keydown');
  await nextTurn();
  assert.ok(sound.resumeCalls > callsBeforeGesture);
  assert.equal(sound.notes, 0);
});

test('replacing a reminder effect in the same turn produces one chime', async t => {
  const sound = await setup(t);
  sound.gesture('click');
  await nextTurn();
  assert.equal(sound.notes, 0);
  const dismissReference = sound.play();
  await nextTurn();
  const notesPerChime = sound.notes;
  assert.ok(notesPerChime > 0);
  dismissReference();
  const dismiss = sound.play();
  dismiss();
  const dismissReplacement = sound.play();
  await nextTurn();
  assert.equal(sound.notes, 2 * notesPerChime);
  dismissReplacement();
});

test('a rejected audio resume leaves reminders usable', async t => {
  const sound = await setup(t, { blockResume: true });
  const dismiss = sound.play();
  sound.gesture('click');
  await nextTurn();
  assert.ok(sound.resumeCalls > 0);
  assert.equal(sound.notes, 0);
  dismiss();
});

test('reminders work when the browser has no Web Audio support', async t => {
  const sound = await setup(t, { supported: false });
  sound.gesture('click');
  const dismiss = sound.play();
  await nextTurn();
  assert.equal(sound.notes, 0);
  dismiss?.();
});
