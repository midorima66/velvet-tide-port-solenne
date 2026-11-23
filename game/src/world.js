// The living world: player, cars, pedestrians, particles and the wanted heat that ties them
// together. stepWorld advances everything one fixed step — player control and car physics
// here, driving and walking brains in ai.js, gunfire in combat.js, the story in missions.js —
// and reports what happened as event flags so main.js can answer with sound and screens.
import { CAR, CLOCK, HEAT, PLAYER, POP, STREET_X, STREET_Y, WORLD } from './config.js';
import { circleBlocked, clampWorld, createCity, laneCoordinate, resolveCircle } from './city.js';
import { pick } from './random.js';
import { CAR_COLORS, PED_COLORS } from './config.js';

export const EV = {
  CRASH: 1, SHOT: 2, PUNCH: 4, PICKUP: 8, BUSTED: 16, WASTED: 32,
  ENTER_CAR: 64, MISSION_DONE: 128, CASH: 256, HURT: 512, SIREN_CRIME: 1024,
};

let nextId = 1;

function makeCar(x, y, angle, color, kind) {
  return {
    id: nextId++, x, y, angle, speed: 0, steer: 0, throttle: 0,
    color, kind, health: 100, driver: null, siren: Math.random() * 6.28,
    ai: { axis: 'x', dir: 1, street: 0, targetSpeed: 0, stuck: 0, decideAt: 0, mode: 'cruise' },
  };
}

/** A random intersection, the natural place for traffic to appear. */
function randomIntersection(random) {
  return {
    sx: Math.floor(random() * STREET_X.length),
    sy: Math.floor(random() * STREET_Y.length),
  };
}

function spawnTrafficCar(world, random) {
  const { sx, sy } = randomIntersection(random);
  const axis = random() < 0.5 ? 'x' : 'y';
  const dir = random() < 0.5 ? 1 : -1;
  let x;
  let y;
  if (axis === 'x') {
    y = laneCoordinate(STREET_Y[sy], dir, 'x');
    x = STREET_X[sx];
  } else {
    x = laneCoordinate(STREET_X[sx], dir, 'y');
    y = STREET_Y[sy];
  }
  if (circleBlocked(world.city, x, y, CAR.radius + 6)) return;
  const car = makeCar(x, y, axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), pick(random, CAR_COLORS), 'traffic');
  car.driver = 'ai';
  car.ai = { axis, dir, street: axis === 'x' ? sy : sx, targetSpeed: 190 + random() * 90, stuck: 0, decideAt: 0, mode: 'cruise' };
  world.cars.push(car);
}

function spawnParkedCar(world, random) {
  const horizontal = random() < 0.5;
  const si = Math.floor(random() * (horizontal ? STREET_Y.length : STREET_X.length));
  const along = 200 + random() * 2400;
  const side = random() < 0.5 ? -1 : 1;
  let x;
  let y;
  let angle;
  if (horizontal) {
    y = STREET_Y[si] + side * 40;
    x = Math.max(80, Math.min(WORLD.width - 80, along));
    angle = side > 0 ? 0 : Math.PI;
  } else {
    x = STREET_X[si] + side * 40;
    y = Math.max(80, Math.min(WORLD.height - 80, along));
    angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  if (circleBlocked(world.city, x, y, CAR.radius + 4)) return;
  if (x > world.city.waterX - 30) return;
  world.cars.push(makeCar(x, y, angle, pick(random, CAR_COLORS), 'parked'));
}

function spawnPedestrian(world, random) {
  const block = world.city.blocks[Math.floor(random() * world.city.blocks.length)];
  const side = Math.floor(random() * 4);
  const t = random();
  const inset = 10;
  let x;
  let y;
  if (side === 0) { x = block.x + inset + t * (block.size - inset * 2); y = block.y + inset; }
  else if (side === 1) { x = block.x + block.size - inset; y = block.y + inset + t * (block.size - inset * 2); }
  else if (side === 2) { x = block.x + inset + t * (block.size - inset * 2); y = block.y + block.size - inset; }
  else { x = block.x + inset; y = block.y + inset + t * (block.size - inset * 2); }
  world.peds.push({
    id: nextId++, x, y, angle: random() * 6.28, speed: 0, color: pick(random, PED_COLORS),
    state: 'walk', block, side, t, health: 60, panic: 0, down: 0,
  });
}

export function createWorld(random) {
  const city = createCity(random);
  const world = {
    city,
    random,
    time: 0,
    clock: CLOCK.start,
    player: {
      x: city.places.diner.x, y: city.places.diner.y + 130, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, weapon: 'fist', ammo: 0, cash: 120, punchTimer: 0, bust: 0, hurtFlash: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [
      { x: city.places.hospital.x, y: city.places.hospital.y, kind: 'health', label: 'Solenne General — free treatment', price: 0 },
      { x: city.places.gunStore.x, y: city.places.gunStore.y, kind: 'pistol', label: 'Harbor Arms — pistol $200', price: 200 },
    ],
    heat: 0,
    heatHidden: 0,
    mission: null,
    stats: { earned: 0, stolen: 0, hits: 0 },
    message: null,
  };
  for (let i = 0; i < POP.trafficCars; i += 1) spawnTrafficCar(world, random);
  for (let i = 0; i < POP.parkedCars; i += 1) spawnParkedCar(world, random);
  for (let i = 0; i < POP.pedestrians; i += 1) spawnPedestrian(world, random);
  return world;
}

export function wantedStars(world) {
  return Math.min(5, Math.floor(world.heat / 100));
}

/** Register a crime: heat rises, nearby police take notice, and the HUD gets its stars. */
export function addHeat(world, points) {
  world.heat = Math.min(520, world.heat + points);
}

/** Spawn a police car at a street edge near (but not on top of) the player. */
export function spawnPolice(world) {
  const p = world.player;
  const spots = [
    { x: p.x - 620, y: p.y }, { x: p.x + 620, y: p.y }, { x: p.x, y: p.y - 620 }, { x: p.x, y: p.y + 620 },
    { x: p.x - 480, y: p.y - 480 }, { x: p.x + 480, y: p.y + 480 },
  ];
  for (const spot of spots) {
    const c = clampWorld(spot.x, spot.y, 60);
    if (circleBlocked(world.city, c.x, c.y, CAR.radius + 8)) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 300) continue;
    const car = makeCar(c.x, c.y, Math.atan2(p.y - c.y, p.x - c.x), '#e8e8ec', 'police');
    car.driver = 'ai';
    car.ai.mode = 'chase';
    car.ai.targetSpeed = 330;
    world.cars.push(car);
    return car;
  }
  return null;
}

export function policeCount(world) {
  let n = 0;
  for (const car of world.cars) if (car.kind === 'police' && car.health > 0) n += 1;
  return n;
}

/** Burst of sparks, smoke or a muzzle flash: cheap particles the renderer draws as circles. */
export function burst(world, x, y, kind, count, color) {
  for (let i = 0; i < count; i += 1) {
    const a = world.random() * Math.PI * 2;
    const sp = kind === 'spark' ? 60 + world.random() * 190 : 18 + world.random() * 46;
    world.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, maxLife: kind === 'smoke' ? 0.9 + world.random() * 0.7 : 0.28 + world.random() * 0.3,
      size: kind === 'smoke' ? 7 + world.random() * 9 : 2 + world.random() * 2.4,
      color, kind,
    });
  }
  if (world.particles.length > 420) world.particles.splice(0, world.particles.length - 420);
}

/** Shared car physics: throttle/steer fields in, motion and collisions out. Returns impact speed. */
export function integrateCar(world, car, dt) {
  const throttle = Math.max(-1, Math.min(1, car.throttle));
  if (throttle >= 0) car.speed += throttle * CAR.accel * dt;
  else if (car.speed > 8) car.speed += throttle * CAR.brake * dt;
  else car.speed = Math.max(-CAR.reverse, car.speed + throttle * 150 * dt);
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const steerAuthority = Math.max(-1, Math.min(1, car.speed / 130));
  car.angle += car.steer * CAR.grip * steerAuthority * dt * 0.62;
  const stepX = Math.cos(car.angle) * car.speed * dt;
  const stepY = Math.sin(car.angle) * car.speed * dt;
  car.x += stepX;
  car.y += stepY;
  let impact = 0;
  // Two body circles, front and back, pushed out of buildings: the car slides along walls.
  for (const off of [-15, 15]) {
    const cx = car.x + Math.cos(car.angle) * off;
    const cy = car.y + Math.sin(car.angle) * off;
    const fixed = resolveCircle(world.city, cx, cy, CAR.radius);
    const pushX = fixed.x - cx;
    const pushY = fixed.y - cy;
    if (pushX !== 0 || pushY !== 0) {
      impact = Math.max(impact, Math.abs(car.speed));
      car.x += pushX;
      car.y += pushY;
      car.speed *= 0.35;
    }
  }
  const clamped = clampWorld(car.x, car.y, 30);
  if (clamped.x !== car.x || clamped.y !== car.y) {
    car.x = clamped.x;
    car.y = clamped.y;
    car.speed *= 0.4;
  }
  if (car.x > world.city.waterX + 16) {
    car.x = world.city.waterX + 16;
    car.speed = Math.min(car.speed, 0);
    impact = Math.max(impact, 60);
  }
  return impact;
}

/** Car against car: separate overlapping pairs, trade momentum, spark on a hard hit. */
export function collideCars(world) {
  let events = 0;
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 37;
      if (d2 >= min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 55) {
        a.health -= closing * 0.06;
        b.health -= closing * 0.06;
        burst(world, (a.x + b.x) / 2, (a.y + b.y) / 2, 'spark', 7, '#ffd166');
        events |= EV.CRASH;
        if ((a.kind === 'police' || b.kind === 'police') && (a === world.player.car || b === world.player.car)) {
          addHeat(world, HEAT.ramPolice * 0.4);
        }
      }
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg;
      b.speed = avg;
    }
  }
  return events;
}

/** Damage the player, with a brief hurt flash for the renderer. */
export function hurtPlayer(world, amount) {
  world.player.health = Math.max(0, world.player.health - amount);
  world.player.hurtFlash = 0.35;
}

/** The nearest car the player could get into, or null. */
export function nearestCar(world, range) {
  const p = world.player;
  let best = null;
  let bestD = range;
  for (const car of world.cars) {
    if (car.health <= -40) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Move the player for one step, on foot or behind the wheel; returns EV flags. */
export function stepPlayer(world, input, dt) {
  let events = 0;
  const p = world.player;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;

  if (p.car) {
    const car = p.car;
    car.throttle = (input.up ? 1 : 0) + (input.down ? -1 : 0);
    car.steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const impact = integrateCar(world, car, dt);
    if (impact > 130) {
      events |= EV.CRASH;
      hurtPlayer(world, (impact - 130) * 0.05);
      burst(world, car.x, car.y, 'smoke', 5, '#555a66');
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (input.enterPressed) {
      const side = car.angle + Math.PI / 2;
      const spot = resolveCircle(world.city, car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, PLAYER.radius);
      p.x = spot.x;
      p.y = spot.y;
      car.driver = null;
      car.throttle = 0;
      car.steer = 0;
      p.car = null;
      events |= EV.ENTER_CAR;
    }
    return events;
  }

  // On foot: WASD/arrows move, Shift runs, the mouse aims when it is held down.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moved = resolveCircle(world.city, p.x + mx * speed * dt, p.y + my * speed * dt, PLAYER.radius);
    const clamped = clampWorld(moved.x, moved.y, PLAYER.radius + 2);
    p.x = clamped.x;
    p.y = clamped.y;
    if (!input.mouseDown) p.angle = Math.atan2(my, mx);
  }
  if (input.mouseDown) p.angle = input.aimAngle;

  if (input.enterPressed) {
    const car = nearestCar(world, 56);
    if (car) {
      const wasDriven = car.driver === 'ai';
      const wasParked = car.kind === 'parked';
      p.car = car;
      car.driver = 'player';
      p.x = car.x;
      p.y = car.y;
      events |= EV.ENTER_CAR;
      if (wasDriven || wasParked) {
        world.stats.stolen += 1;
        addHeat(world, HEAT.stealCar);
        events |= EV.SIREN_CRIME;
        // The rightful driver bails out and runs.
        for (const ped of world.peds) {
          if (Math.hypot(ped.x - car.x, ped.y - car.y) < 60 && ped.state !== 'down') {
            ped.state = 'flee';
            ped.panic = 2.4;
          }
        }
      }
    }
  }

  // Pickups: treatment, a pistol for cash, dropped money.
  for (const pickup of world.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) > 30) continue;
    if (pickup.kind === 'health' && p.health < PLAYER.health) {
      p.health = PLAYER.health;
      pickup.taken = true;
      events |= EV.PICKUP;
    } else if (pickup.kind === 'pistol' && p.cash >= pickup.price) {
      p.cash -= pickup.price;
      p.weapon = 'pistol';
      p.ammo += 60;
      pickup.taken = true;
      events |= EV.PICKUP;
    } else if (pickup.kind === 'cash') {
      p.cash += pickup.amount;
      world.stats.earned += pickup.amount;
      pickup.taken = true;
      events |= EV.CASH;
    }
  }
  return events;
}

/** Clock, particles, wanted heat, police numbers and the busted/wasted verdicts. */
export function stepAmbient(world, dt) {
  let events = 0;
  world.time += dt;
  world.clock = (world.clock + dt * CLOCK.minutesPerSecond) % 1440;

  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    if (pt.life >= pt.maxLife) world.particles.splice(i, 1);
  }

  // Police attention: how many cruisers the current stars are worth, spawned off-screen.
  const stars = wantedStars(world);
  const want = stars === 0 ? 0 : Math.min(POP.policeMax, 2 + stars);
  world.policeTimer = (world.policeTimer ?? 0) - dt;
  if (policeCount(world) < want && world.policeTimer <= 0) {
    if (spawnPolice(world)) world.policeTimer = 1.1;
  }
  if (stars === 0) {
    // No heat: cruisers give up and leave the world once they are far away.
    for (let i = world.cars.length - 1; i >= 0; i -= 1) {
      const car = world.cars[i];
      if (car.kind === 'police' && Math.hypot(car.x - world.player.x, car.y - world.player.y) > 700) {
        world.cars.splice(i, 1);
      }
    }
  }

  // Heat drains slowly under police eyes and quickly once the player is out of sight.
  let seen = false;
  for (const car of world.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - world.player.x, car.y - world.player.y) < 470) seen = true;
  }
  world.heatHidden = seen ? 0 : world.heatHidden + dt;
  const drain = world.heatHidden > 2.5 ? HEAT.decayWhenHidden : HEAT.decayPerSecond;
  if (world.heat > 0) world.heat = Math.max(0, world.heat - drain * dt);

  // Busted: a cruiser holding the player still — on foot beside him, or pinning his car.
  const p = world.player;
  let pinned = false;
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (!p.car && d < 52 && Math.abs(car.speed) < 60) pinned = true;
    if (p.car && d < 64 && Math.abs(p.car.speed) < 14) pinned = true;
  }
  if (pinned && stars > 0) {
    p.bust += dt;
    if (p.bust >= HEAT.bustedSeconds) events |= EV.BUSTED;
  } else {
    p.bust = Math.max(0, p.bust - dt * 2.2);
  }
  if (p.health <= 0) events |= EV.WASTED;

  // Cars meet pedestrians: a fast car knocks a walker down; the player's hits are crimes.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    for (const car of world.cars) {
      if (Math.abs(car.speed) < 55) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) > 24) continue;
      ped.state = 'down';
      ped.down = 5;
      ped.health = 0;
      burst(world, ped.x, ped.y, 'spark', 6, '#e8e3d5');
      events |= EV.CRASH;
      if (car === p.car) {
        addHeat(world, HEAT.hitPedestrian);
        world.stats.hits += 1;
        events |= EV.SIREN_CRIME;
      }
      break;
    }
  }
  return events;
}

