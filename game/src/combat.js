// Fists and gunfire: Marlo's punch, the Harbor Arms pistol, and the bullets between. Combat
// is loud — shots panic pedestrians and draw police heat — and it is aimed with the mouse,
// whether Marlo is on foot or leaning out of a driver's window.
import { HEAT, PLAYER, WEAPON } from './config.js';
import { circleBlocked } from './city.js';
import { EV, addHeat, burst } from './world.js';

/** Everyone within earshot runs, and the world remembers where the danger is. */
function panicCrowd(world, x, y, radius) {
  world.threat = { x, y };
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.panic = Math.max(ped.panic, 1.8);
    }
  }
}

function punch(world) {
  const p = world.player;
  let events = EV.PUNCH;
  const reach = PLAYER.punchRange;
  const hx = p.x + Math.cos(p.angle) * reach;
  const hy = p.y + Math.sin(p.angle) * reach;
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - hx, ped.y - hy) < 24) {
      ped.health -= WEAPON.fist.damage;
      burst(world, ped.x, ped.y, 'spark', 4, '#e8e3d5');
      if (ped.health <= 0) {
        ped.state = 'down';
        ped.down = 6;
        addHeat(world, 70);
      } else {
        ped.state = 'flee';
        ped.panic = 2.2;
        addHeat(world, 30);
      }
      events |= EV.SIREN_CRIME;
    }
  }
  for (const car of world.cars) {
    if (car === p.car) continue;
    if (Math.hypot(car.x - hx, car.y - hy) < 30) {
      car.health -= 6;
      burst(world, hx, hy, 'spark', 3, '#ffd166');
    }
  }
  panicCrowd(world, p.x, p.y, 90);
  return events;
}

function shoot(world) {
  const p = world.player;
  const from = p.car ?? p;
  const bx = from.x + Math.cos(p.angle) * 20;
  const by = from.y + Math.sin(p.angle) * 20;
  world.bullets.push({
    x: bx, y: by,
    vx: Math.cos(p.angle) * WEAPON.pistol.speed,
    vy: Math.sin(p.angle) * WEAPON.pistol.speed,
    life: WEAPON.pistol.range / WEAPON.pistol.speed,
  });
  burst(world, bx, by, 'flash', 3, '#ffe08a');
  panicCrowd(world, p.x, p.y, 280);
  addHeat(world, HEAT.shootNearPolice * 0.55);
  return EV.SHOT | EV.SIREN_CRIME;
}

/** One step of fighting: read the trigger, then fly every bullet to its end. */
export function stepCombat(world, input, dt) {
  let events = 0;
  const p = world.player;
  if (p.fireTimer === undefined) p.fireTimer = 0;
  if (p.fireTimer > 0) p.fireTimer -= dt;

  const wantsAttack = input.attackPressed || (input.mouseDown && p.weapon === 'pistol');
  if (wantsAttack && p.fireTimer <= 0) {
    if (p.weapon === 'pistol' && p.ammo > 0) {
      p.ammo -= 1;
      p.fireTimer = WEAPON.pistol.cooldown;
      events |= shoot(world);
      if (p.ammo === 0) p.weapon = 'fist';
    } else if (!p.car && p.punchTimer <= 0) {
      p.punchTimer = WEAPON.fist.cooldown;
      p.fireTimer = WEAPON.fist.cooldown;
      events |= punch(world);
    }
  }

  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && circleBlocked(world.city, b.x, b.y, 3)) {
      burst(world, b.x, b.y, 'spark', 3, '#ffd166');
      dead = true;
    }
    if (!dead) {
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.health -= WEAPON.pistol.damage;
          ped.state = 'down';
          ped.down = 7;
          addHeat(world, 130);
          events |= EV.SIREN_CRIME;
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car === p.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 22) {
          car.health -= WEAPON.pistol.damage * 0.5;
          burst(world, b.x, b.y, 'spark', 5, '#ffd166');
          if (car.kind === 'police') addHeat(world, 60);
          dead = true;
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }
  return events;
}
