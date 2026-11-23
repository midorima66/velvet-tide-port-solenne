// Boot and the one loop. Velvet Tide advances in fixed 1/60 s steps — input sampled, the
// world stepped (player, traffic, crowds, combat, the heat, the story), sound answered to
// the step's events, and the renderer paints the result — across five screens: title, play,
// paused, busted/wasted, and the story's end. Progress is saved to this browser after every
// chapter and whenever Marlo sleeps it off at the hospital or the station.
//
// ?seed=N fixes the city. ?shot=start|foot|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { EV, createWorld, nearestCar, stepAmbient, stepPlayer } from './world.js';
import { stepPeds, stepTraffic } from './ai.js';
import { stepCombat } from './combat.js';
import { resumeStory, startStory, stepMissions } from './missions.js';
import { createAudio } from './audio.js';
import { ACT, createInput } from './input.js';
import {
  SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(world) {
  try {
    const m = world.mission;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.player.cash,
      earned: world.stats.earned,
      stolen: world.stats.stolen,
      hits: world.stats.hits,
      nextMission: world.completed ? world.missions.length : (m.started ? m.index : m.index + 1),
      completed: world.completed,
      weapon: world.player.weapon,
      ammo: world.player.ammo,
      x: world.player.x,
      y: world.player.y,
    }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

function runShot(name) {
  const world = createWorld(createRandom(seed));
  startStory(world);
  const scene = stageShot(name, world);
  const ui = { screen: scene.screen, muted: true, prompt: null, overReason: null, saveExists: false };
  let painted = 0;
  function paint() {
    renderer.draw(world, ui);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let world = createWorld(createRandom(seed));
  startStory(world);
  let screen = SCREEN_TITLE;
  let overReason = null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function freshWorld() {
    world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)));
    startStory(world);
  }

  function beginNewGame() {
    freshWorld();
    audio.start();
    screen = SCREEN_PLAY;
    announce('Velvet Tide. Chapter one waits at the Tidewater Diner.');
  }

  function beginContinue() {
    const save = readSave();
    freshWorld();
    if (save) {
      world.player.cash = save.cash;
      world.stats.earned = save.earned;
      world.stats.stolen = save.stolen;
      world.stats.hits = save.hits;
      world.player.weapon = save.weapon;
      world.player.ammo = save.ammo;
      if (save.weapon === 'pistol' && save.ammo === 0) world.player.weapon = 'fist';
      resumeStory(world, save.nextMission, save.completed);
    }
    audio.start();
    screen = SCREEN_PLAY;
    announce('Welcome back to Port Solenne.');
  }

  function respawn() {
    const p = world.player;
    const spot = overReason === 'busted' ? world.city.places.policeStation : world.city.places.hospital;
    if (p.car) {
      p.car.driver = null;
      p.car = null;
    }
    p.x = spot.x;
    p.y = spot.y;
    p.health = 100;
    p.bust = 0;
    world.heat = 0;
    world.bullets.length = 0;
    screen = SCREEN_PLAY;
    writeSave(world);
  }

  function handleEvents(events) {
    audio.playEvents(events);
    if (events & EV.MISSION_DONE) {
      writeSave(world);
      if (world.completed) {
        screen = SCREEN_COMPLETE;
        announce('The Long Goodbye is complete. Port Solenne is yours.');
      } else {
        announce('Chapter complete. The diner has more work.');
      }
    }
    if (events & EV.BUSTED) {
      overReason = 'busted';
      world.player.cash = Math.max(0, world.player.cash - Math.min(300, Math.round(world.player.cash * 0.25)));
      screen = SCREEN_OVER;
      announce('Busted. Bail comes out of your pocket.');
    } else if (events & EV.WASTED) {
      overReason = 'wasted';
      world.player.cash = Math.max(0, world.player.cash - Math.min(250, Math.round(world.player.cash * 0.2)));
      screen = SCREEN_OVER;
      announce('Wasted. Solenne General patches you up, for a price.');
    }
  }

  function currentPrompt() {
    const p = world.player;
    if (p.car) return 'E — Get out';
    const car = nearestCar(world, 56);
    if (car) return car.kind === 'parked' || car.driver === 'ai' ? 'E — Steal this car' : 'E — Get in';
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 44) return pickup.label;
    }
    return null;
  }

  function stepOnce(actions) {
    const p = world.player;
    const screenX = p.x - renderer.camera.x;
    const screenY = p.y - renderer.camera.y;
    const stepInput = input.sample(screenX, screenY);
    if (actions & ACT.MUTE) audio.toggleMute();
    if (actions & ACT.SAVE) {
      writeSave(world);
      announce('Saved.');
    }
    let events = 0;
    events |= stepPlayer(world, stepInput, STEP);
    stepTraffic(world, STEP);
    stepPeds(world, STEP);
    events |= stepCombat(world, stepInput, STEP);
    events |= stepAmbient(world, STEP);
    events |= stepMissions(world, STEP);
    // Dialogue lines breathe for a few seconds each, or advance on a click/Enter.
    if (world.dialogue) {
      world.dialogue.timer += STEP;
      if (world.dialogue.timer > 4.6 || (actions & ACT.CONFIRM)) {
        world.dialogue.at += 1;
        world.dialogue.timer = 0;
        if (world.dialogue.at >= world.dialogue.lines.length) world.dialogue = null;
      }
    }
    handleEvents(events);
    audio.update(world);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen !== SCREEN_PLAY) {
      if (screen === SCREEN_TITLE) {
        if (actions & ACT.CONFIRM) beginNewGame();
        else if ((actions & ACT.CONTINUE) && readSave()) beginContinue();
      } else if (screen === SCREEN_PAUSED) {
        if (actions & (ACT.PAUSE | ACT.CONFIRM)) screen = SCREEN_PLAY;
      } else if (screen === SCREEN_OVER) {
        if (actions & ACT.CONFIRM) respawn();
      } else if (screen === SCREEN_COMPLETE) {
        if (actions & ACT.CONFIRM) screen = SCREEN_PLAY;
      }
      accumulator = 0;
    } else if (actions & ACT.PAUSE) {
      screen = SCREEN_PAUSED;
      accumulator = 0;
    } else {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepOnce(actions);
        accumulator -= STEP;
      }
    }
    const ui = {
      screen,
      muted: audio.isMuted(),
      prompt: screen === SCREEN_PLAY ? currentPrompt() : null,
      overReason,
      saveExists: Boolean(readSave()),
    };
    renderer.draw(world, ui);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('Velvet Tide: Port Solenne. Press Enter to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
