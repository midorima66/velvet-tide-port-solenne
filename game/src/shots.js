// The screenshot scenes behind ?shot=start|foot|chase|mission. Each one builds a real moment
// of the game from a fresh seeded world — the title's sunset pan, Marlo on foot as his first
// errand begins, a four-star chase through downtown, and the crate run waiting at the docks —
// then plays the simulation forward a few seconds with scripted hands, so the frame is the
// game as it truly looks, and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EV, spawnPolice, stepAmbient, stepPlayer } from './world.js';
import { stepPeds, stepTraffic } from './ai.js';
import { stepCombat } from './combat.js';
import { startStory, stepMissions } from './missions.js';

const IDLE = { up: false, down: false, left: false, right: false, run: false, mouseDown: false, attackPressed: false, enterPressed: false, aimAngle: 0 };

function runSeconds(world, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    let events = 0;
    events |= stepPlayer(world, input, STEP);
    stepTraffic(world, STEP);
    stepPeds(world, STEP);
    events |= stepCombat(world, IDLE, STEP);
    events |= stepAmbient(world, STEP);
    events |= stepMissions(world, STEP);
    void events;
  }
}

/** Put the player behind the wheel of the nearest car, moved to a chosen spot. */
function commandeer(world, x, y, angle, speed) {
  let car = world.cars.find((c) => c.kind === 'parked') ?? world.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.driver = 'player';
  car.throttle = 0;
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

function stageStart(world) {
  world.clock = 18 * 60 + 5;
  runSeconds(world, 3, IDLE);
  return { screen: SCREEN_TITLE };
}

function stageFoot(world) {
  world.clock = 17 * 60 + 52;
  startStory(world);
  // Marlo starts down the street from the diner; a short walk north starts chapter one,
  // with Vi's first line and the gold marker to the docks on the HUD.
  world.player.x = world.city.places.diner.x;
  world.player.y = world.city.places.diner.y + 175;
  // A few locals on the pavement by the diner, so the street feels lived in.
  const corner = [
    { x: world.city.places.diner.x - 66, y: world.city.places.diner.y - 30 },
    { x: world.city.places.diner.x + 88, y: world.city.places.diner.y + 44 },
    { x: world.city.places.diner.x - 30, y: world.city.places.diner.y + 96 },
  ];
  world.peds.slice(0, 3).forEach((ped, i) => {
    ped.x = corner[i].x;
    ped.y = corner[i].y;
    ped.state = 'walk';
  });
  runSeconds(world, 1.7, { ...IDLE, up: true });
  world.dialogue = { lines: world.missions[0].intro, at: 0, timer: 0 };
  return { screen: SCREEN_PLAY };
}

function stageChase(world) {
  world.clock = 18 * 60 + 12;
  startStory(world);
  const roadY = 900; // the downtown east-west avenue
  commandeer(world, 700, roadY + 27, 0, 250);
  world.player.cash = 640;
  world.mission.index = 2;
  world.mission.started = true;
  world.mission.stage = 1;
  world.objective = {
    x: world.city.places.chopShop.x, y: world.city.places.chopShop.y,
    text: "Deliver the coupe to Rook's Chop Shop — lose the police first if you can",
  };
  world.heat = 430; // four stars
  // Three cruisers on the tail, strung out behind the coupe down the avenue.
  const tail = [[-84, -27, 266], [-156, 27, 256], [-244, -27, 284]];
  for (const [dx, dy, speed] of tail) {
    const cop = spawnPolice(world);
    if (!cop) break;
    cop.x = 700 + dx;
    cop.y = roadY + dy;
    cop.angle = 0;
    cop.speed = speed;
  }
  runSeconds(world, 1.0, { ...IDLE, up: true });
  world.heat = Math.max(world.heat, 430);
  return { screen: SCREEN_PLAY };
}

function stageMission(world) {
  world.clock = 19 * 60 + 4;
  startStory(world);
  const docks = world.city.places.docks;
  // Marlo has just rolled up to the gold ring at Berth 9; the crate waits a step away.
  commandeer(world, docks.x - 92, docks.y + 6, 0.35, 0);
  world.mission.index = 0;
  world.mission.started = true;
  world.mission.stage = 0;
  world.objective = {
    x: docks.x, y: docks.y,
    text: 'Pick up the crate at Berth 9, South Docks',
  };
  world.dialogue = {
    lines: [['Marlo', 'Berth 9. One crate, no questions — just like Vi ordered.']],
    at: 0, timer: 0,
  };
  runSeconds(world, 1.2, IDLE);
  return { screen: SCREEN_PLAY };
}

/** Set the world to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  if (name === 'foot') return stageFoot(world);
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMission(world);
  return stageStart(world);
}

export { EV };
