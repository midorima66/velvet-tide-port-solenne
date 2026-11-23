// The story of Velvet Tide: five errands for Violetta "Auntie Vi" Marchetti, who runs the
// Tidewater Diner and half the favours in Port Solenne. Marlo Reyes, her nephew and a
// wheelman who swore he was done, takes them one at a time: a crate from the docks, fares
// across town, a hot car, three debts, and one last drive to the lighthouse. Between
// missions the city is free to roam; the gold marker always points at the next chapter.
import { HEAT } from './config.js';
import { EV, addHeat } from './world.js';

const VI = 'Auntie Vi';
const MARLO = 'Marlo';

function missionDefs(places) {
  return [
    {
      title: 'Welcome Home',
      reward: 150,
      intro: [
        [VI, 'Marlo Reyes. Six years gone and you walk in thinner. Sit. Eat. Then earn it.'],
        [MARLO, 'I came back to rest, Vi.'],
        [VI, 'Rest is for the rich, tesoro. Berth 9, South Docks — a crate with my name on it. Bring it home.'],
      ],
      outro: [[VI, 'Still warm, still sealed. You still drive like your father. Worse parking, though.']],
      stages: [
        { type: 'goto', x: places.docks.x, y: places.docks.y, text: 'Pick up the crate at Berth 9, South Docks', radius: 64 },
        { type: 'deliver', x: places.diner.x, y: places.diner.y, text: 'Bring the crate back to the Tidewater Diner (you need a car)', radius: 74 },
      ],
    },
    {
      title: 'Fare Game',
      reward: 270,
      intro: [
        [VI, 'My taxi driver quit mid-shift. Three fares, already waiting, already angry.'],
        [MARLO, 'I am not a taxi driver.'],
        [VI, 'You are whatever the meter says you are. Be gentle with the corners.'],
      ],
      outro: [[VI, 'Five stars, they said. Five. From a man who once outran the harbour patrol.']],
      stages: [
        { type: 'fare', x: places.hotel.x, y: places.hotel.y, dx: places.marina.x, dy: places.marina.y, label: 'the Velvetine Hotel', dropLabel: 'Velvet Marina', text: 'Pick up the fare at the Velvetine Hotel', radius: 62 },
        { type: 'fare', x: places.depot.x, y: places.depot.y, dx: places.diner.x, dy: places.diner.y, label: 'the Old Bus Depot', dropLabel: 'the Tidewater Diner', text: 'Pick up the fare at the Old Bus Depot', radius: 62 },
        { type: 'fare', x: places.gunStore.x, y: places.gunStore.y, dx: places.hotel.x, dy: places.hotel.y, label: 'Harbor Arms', dropLabel: 'the Velvetine Hotel', text: 'Pick up the fare outside Harbor Arms', radius: 62 },
      ],
    },
    {
      title: 'Hot Cargo',
      reward: 400,
      intro: [
        [VI, 'A coupe at the Old Bus Depot. Cream paint, no plates, keys in. Rook is waiting at the chop shop.'],
        [MARLO, 'And if the police are also waiting?'],
        [VI, 'Then drive like the tide, Marlo. It never argues with the shore. It just leaves.'],
      ],
      outro: [[VI, 'Rook says the car sang all the way in. He also says you owe him a bumper.']],
      stages: [
        { type: 'goto', x: places.depot.x, y: places.depot.y, text: 'Find the cream coupe at the Old Bus Depot', radius: 70 },
        { type: 'hotcar', x: places.chopShop.x, y: places.chopShop.y, text: "Deliver the coupe to Rook's Chop Shop — lose the police first if you can", radius: 80 },
      ],
    },
    {
      title: 'Collections',
      reward: 360,
      intro: [
        [VI, 'Three friends of the diner owe for a year of dinners. Polite visits, Marlo. Mostly polite.'],
        [MARLO, 'Addresses?'],
        [VI, 'Gold markers, like always. Stand close, smile, and let the envelope come to you.'],
      ],
      outro: [[VI, 'Every cent. One of them cried, one of them hugged you — growth, tesoro.']],
      stages: [
        { type: 'collect', x: places.hotel.x + 60, y: places.hotel.y + 250, text: 'Collect from the debtor by the Velvetine', radius: 40, cash: 120 },
        { type: 'collect', x: places.marina.x, y: places.marina.y - 250, text: 'Collect from the debtor near Velvet Marina', radius: 40, cash: 120 },
        { type: 'collect', x: places.policeStation.x - 60, y: places.policeStation.y + 10, text: 'Collect from the debtor in the downtown blocks', radius: 40, cash: 120 },
      ],
    },
    {
      title: 'The Long Goodbye',
      reward: 1000,
      intro: [
        [VI, 'Last one, and it is not an errand. It is me. Take me to Gull Rock Lighthouse, tonight.'],
        [MARLO, 'Running from something, Vi?'],
        [VI, 'Running TO something, for once. The whole harbour will try to stop us. Drive, tesoro.'],
      ],
      outro: [
        [VI, 'Look at that light. Forty years I fed this city. Now it can feed itself.'],
        [MARLO, 'And me?'],
        [VI, 'You, Marlo Reyes, are home. That is the whole treasure.'],
      ],
      stages: [
        { type: 'goto', x: places.diner.x, y: places.diner.y, text: 'Pick up Auntie Vi at the Tidewater Diner (arrive by car)', radius: 74, needCar: true },
        { type: 'finale', x: places.lighthouse.x, y: places.lighthouse.y, text: 'Drive Vi to Gull Rock Lighthouse — the harbour is watching', radius: 84 },
      ],
    },
  ];
}

/** Begin the story: the first gold marker waits outside the diner. */
export function startStory(world) {
  world.missions = missionDefs(world.city.places);
  world.mission = { index: -1, stage: 0, sub: 0, timer: 0, dwell: 0, started: false };
  world.completed = false;
  setBetweenObjective(world);
}

function setBetweenObjective(world) {
  const m = world.mission;
  if (m.index + 1 >= world.missions.length) {
    world.objective = null;
    return;
  }
  const next = world.missions[m.index + 1];
  world.objective = {
    x: world.city.places.diner.x, y: world.city.places.diner.y,
    text: `Go to the Tidewater Diner — next: “${next.title}”`,
  };
}

function speak(world, lines) {
  world.dialogue = { lines, at: 0, timer: 0 };
}

function beginMission(world) {
  const m = world.mission;
  m.index += 1;
  m.stage = 0;
  m.sub = 0;
  m.dwell = 0;
  m.started = true;
  const def = world.missions[m.index];
  speak(world, def.intro);
  applyStage(world);
  if (def.title === 'Hot Cargo') {
    // The coupe waits at the depot, cream paint, engine warm.
  }
}

function applyStage(world) {
  const m = world.mission;
  const def = world.missions[m.index];
  const stage = def.stages[m.stage];
  world.objective = { x: stage.x, y: stage.y, text: stage.text };
  if (stage.type === 'hotcar') {
    addHeat(world, 300); // the depot was watched: three stars the moment the coupe rolls
  }
  if (stage.type === 'finale') {
    addHeat(world, Math.max(0, 420 - world.heat));
  }
}

function finishMission(world) {
  const m = world.mission;
  const def = world.missions[m.index];
  world.player.cash += def.reward;
  world.stats.earned += def.reward;
  speak(world, def.outro);
  m.started = false;
  m.stage = 0;
  if (def.title === 'The Long Goodbye') {
    world.completed = true;
    world.objective = null;
    world.mission.index = world.missions.length;
    return EV.MISSION_DONE | EV.CASH;
  }
  setBetweenObjective(world);
  return EV.MISSION_DONE | EV.CASH;
}

function near(world, x, y, radius) {
  return Math.hypot(world.player.x - x, world.player.y - y) <= radius;
}

/** Restore a saved run: the story resumes with the chapter that was next to play. */
export function resumeStory(world, nextMission, completed) {
  if (!world.missions) startStory(world);
  const m = world.mission;
  world.completed = Boolean(completed);
  if (world.completed) {
    m.index = world.missions.length;
    m.started = false;
    world.objective = null;
    return;
  }
  m.index = Math.max(0, Math.min(world.missions.length - 1, nextMission)) - 1;
  m.started = false;
  m.stage = 0;
  setBetweenObjective(world);
}

/** Advance the story one step; returns EV flags (mission done, cash, crimes of opportunity). */
export function stepMissions(world, dt) {
  let events = 0;
  const m = world.mission;
  if (!m || world.completed) return 0;

  if (!m.started) {
    if (near(world, world.city.places.diner.x, world.city.places.diner.y, 84)) {
      beginMission(world);
      events |= EV.PICKUP;
    }
    return events;
  }

  const def = world.missions[m.index];
  const stage = def.stages[m.stage];
  const p = world.player;

  const advance = () => {
    m.stage += 1;
    m.sub = 0;
    m.dwell = 0;
    if (m.stage >= def.stages.length) events |= finishMission(world);
    else applyStage(world);
  };

  if (stage.type === 'goto') {
    if (near(world, stage.x, stage.y, stage.radius) && (!stage.needCar || p.car)) advance();
  } else if (stage.type === 'deliver') {
    if (near(world, stage.x, stage.y, stage.radius) && p.car) advance();
  } else if (stage.type === 'hotcar') {
    if (near(world, stage.x, stage.y, stage.radius) && p.car) advance();
  } else if (stage.type === 'finale') {
    if (near(world, stage.x, stage.y, stage.radius) && p.car) advance();
  } else if (stage.type === 'fare') {
    if (m.sub === 0) {
      if (near(world, stage.x, stage.y, stage.radius) && p.car && Math.abs(p.car.speed) < 12) {
        m.dwell += dt;
        world.objective = { x: stage.x, y: stage.y, text: 'Wait for your fare to get in…' };
        if (m.dwell > 1.1) {
          m.sub = 1;
          m.dwell = 0;
          p.cash += 30;
          world.objective = { x: stage.dx, y: stage.dy, text: `Drive your fare to ${stage.dropLabel}` };
          events |= EV.CASH;
        }
      } else m.dwell = 0;
    } else if (near(world, stage.dx, stage.dy, stage.radius) && p.car && Math.abs(p.car.speed) < 12) {
      m.dwell += dt;
      if (m.dwell > 0.8) {
        p.cash += 60;
        world.stats.earned += 60;
        events |= EV.CASH;
        advance();
      }
    } else m.dwell = 0;
  } else if (stage.type === 'collect') {
    if (near(world, stage.x, stage.y, stage.radius) && !p.car) {
      m.dwell += dt;
      world.objective = { x: stage.x, y: stage.y, text: 'Collecting the envelope…' };
      if (m.dwell > 1.6) {
        p.cash += stage.cash;
        world.stats.earned += stage.cash;
        events |= EV.CASH;
        if (m.stage === 1) addHeat(world, HEAT.stealCar); // the second debtor phones the police
        advance();
      }
    } else {
      m.dwell = 0;
      world.objective = { x: stage.x, y: stage.y, text: `${stage.text} (on foot)` };
    }
  }
  return events;
}

/** The current mission's public face for the HUD: chapter title and progress. */
export function missionBanner(world) {
  const m = world.mission;
  if (!m || world.completed) return null;
  if (!m.started) return { title: 'Free roam', line: 'Port Solenne is yours. The diner has work when you want it.' };
  const def = world.missions[m.index];
  return { title: `Chapter ${m.index + 1} — ${def.title}`, line: world.objective ? world.objective.text : '' };
}
