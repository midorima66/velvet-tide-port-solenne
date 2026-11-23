// Keyboard and mouse, read as one state object the simulation samples every step. Held keys
// are booleans; one-shot presses (Enter to start, E for a car door, P for pause, M for mute,
// a click to strike) are latched until the loop takes them, so a press between two frames is
// never lost and never counted twice. The mouse aims Marlo's fists and pistol.
import { VIEW } from './config.js';

export const ACT = { CONFIRM: 1, PAUSE: 2, ENTER: 4, MUTE: 8, SAVE: 16, CONTINUE: 32 };

const HELD = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  const state = {
    up: false, down: false, left: false, right: false, run: false,
    mouseDown: false, attackPressed: false, enterPressed: false,
    aimAngle: 0, actions: 0,
  };
  let mouseX = VIEW.width / 2;
  let mouseY = VIEW.height / 2;
  let attackQueued = false;
  let enterQueued = false;

  function setHeld(code, value) {
    for (const name of Object.keys(HELD)) {
      if (HELD[name].includes(code)) held[name] = value;
    }
  }

  window.addEventListener('keydown', (event) => {
    setHeld(event.code, true);
    if (event.code === 'Enter' || event.code === 'Space') {
      if (!event.repeat) state.actions |= ACT.CONFIRM;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) state.actions |= ACT.PAUSE;
    } else if (event.code === 'KeyE' || event.code === 'KeyF') {
      if (!event.repeat) enterQueued = true;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) state.actions |= ACT.MUTE;
    } else if (event.code === 'KeyK') {
      if (!event.repeat) state.actions |= ACT.SAVE;
    } else if (event.code === 'KeyC') {
      if (!event.repeat) state.actions |= ACT.CONTINUE;
    } else if (event.code === 'KeyJ') {
      if (!event.repeat) attackQueued = true;
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => setHeld(event.code, false));
  window.addEventListener('blur', () => {
    for (const name of Object.keys(held)) held[name] = false;
    state.mouseDown = false;
  });

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    mouseX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  }
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    state.mouseDown = true;
    attackQueued = true;
    state.actions |= ACT.CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    state.mouseDown = false;
  });

  /** Sample the state for one simulation step, centred on the player's screen position. */
  function sample(playerScreenX, playerScreenY) {
    state.up = held.up;
    state.down = held.down;
    state.left = held.left;
    state.right = held.right;
    state.run = held.run;
    state.attackPressed = attackQueued;
    state.enterPressed = enterQueued;
    attackQueued = false;
    enterQueued = false;
    state.aimAngle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
    return state;
  }

  /** Take the latched one-shot actions (ACT flags) exactly once. */
  function takeActions() {
    const taken = state.actions;
    state.actions = 0;
    return taken;
  }

  return { sample, takeActions };
}
