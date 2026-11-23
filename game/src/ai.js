// The brains of everyone who is not the player: traffic cars that keep to their lanes and
// turn at intersections, police cruisers that hunt along the street grid and ram when close,
// and pedestrians who stroll the sidewalks and run from danger. All of them drive through the
// same physics as the player (integrateCar), steered by a waypoint just ahead of the car.
import { STREET_X, STREET_Y } from './config.js';
import { clampWorld, laneCoordinate } from './city.js';
import { burst, integrateCar } from './world.js';

function angleTo(from, x, y) {
  return Math.atan2(y - from.y, x - from.x);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer a car toward a point and manage its throttle, including stopping for traffic. */
function driveToward(world, car, tx, ty, targetSpeed, dt) {
  const desired = angleTo(car, tx, ty);
  const diff = angleDiff(desired, car.angle);
  car.steer = Math.max(-1, Math.min(1, diff * 2.4));
  let speed = targetSpeed;
  if (Math.abs(diff) > 1.1) speed = Math.min(speed, 60);
  // A car close ahead in the same direction means brakes, whatever the plan was.
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 58 && side < 20) {
      speed = Math.min(speed, Math.max(0, (ahead - 34) * 4));
    }
  }
  if (car.ai.reverse > 0) {
    car.ai.reverse -= dt;
    car.throttle = -1;
    car.steer = -car.steer;
    return;
  }
  car.throttle = car.speed < speed ? 0.85 : -0.4;
  // Stuck against a wall with the throttle down: back out and try again.
  if (Math.abs(car.speed) < 9 && car.throttle > 0.3) {
    car.ai.stuck += dt;
    if (car.ai.stuck > 1.3) {
      car.ai.stuck = 0;
      car.ai.reverse = 0.65;
    }
  } else car.ai.stuck = 0;
}

/** The next intersection centre along the car's axis of travel, and its street index. */
function nextIntersection(car) {
  const along = car.ai.axis === 'x' ? STREET_X : STREET_Y;
  const pos = car.ai.axis === 'x' ? car.x : car.y;
  let best = null;
  let bestIdx = -1;
  for (let i = 0; i < along.length; i += 1) {
    const d = (along[i] - pos) * car.ai.dir;
    if (d > 4 && (best === null || d < best)) {
      best = d;
      bestIdx = i;
    }
  }
  return { distance: best, index: bestIdx };
}

/** Keep a cruising car in its lane, turning at intersections as the dice (or the hunt) say. */
function cruise(world, car, dt, chooseTurn) {
  const ai = car.ai;
  const cross = ai.axis === 'x' ? STREET_Y : STREET_X;
  const lane = laneCoordinate(cross[ai.street], ai.dir, ai.axis);
  const pos = ai.axis === 'x' ? car.x : car.y;
  const { distance, index } = nextIntersection(car);
  let tx;
  let ty;
  if (ai.turning) {
    tx = ai.turnX;
    ty = ai.turnY;
    const done = Math.hypot(tx - car.x, ty - car.y) < 42 || Math.abs((ai.axis === 'x' ? car.y : car.x) - lane) < 6 && distance !== null && distance < 30;
    if (done) ai.turning = false;
  } else if (distance !== null && distance < 95 && ai.decidedFor !== index) {
    ai.decidedFor = index;
    const turn = chooseTurn(world, car, index);
    if (turn !== 0) {
      const crossCentre = (ai.axis === 'x' ? STREET_Y : STREET_X)[ai.street];
      const interPos = (ai.axis === 'x' ? STREET_X : STREET_Y)[index];
      const newAxis = ai.axis === 'x' ? 'y' : 'x';
      const newStreet = index;
      const newLane = laneCoordinate(crossCentre, turn, newAxis);
      ai.turnX = newAxis === 'y' ? newLane : interPos + turn * 130;
      ai.turnY = newAxis === 'y' ? interPos + turn * 130 : newLane;
      ai.axis = newAxis;
      ai.dir = turn;
      ai.street = newStreet;
      ai.turning = true;
      tx = ai.turnX;
      ty = ai.turnY;
    }
  }
  if (tx === undefined) {
    const ahead = 120;
    tx = ai.axis === 'x' ? car.x + ai.dir * ahead : lane;
    ty = ai.axis === 'x' ? lane : car.y + ai.dir * ahead;
    // Correct any drift from the lane centre.
    if (ai.axis === 'x') ty = lane;
    else tx = lane;
    void pos;
  }
  driveToward(world, car, tx, ty, ai.targetSpeed, dt);
}

function trafficTurn(world, car) {
  return world.random() < 0.42 ? (world.random() < 0.5 ? 1 : -1) : 0;
}

/** Police choose the exit that closes on the player; close in, they simply drive at him. */
function stepPolice(world, car, dt) {
  const p = world.player;
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  car.ai.targetSpeed = d > 300 ? 355 : 300;
  if (d < 235) {
    // Ram range: aim a touch ahead of the player's motion so the cruiser intercepts,
    // with a per-cruiser flank offset so a pack fans out instead of stacking up.
    const lead = p.car ? 0.35 : 0.1;
    const flank = ((car.id % 3) - 1) * 36;
    const baseX = p.x + (p.car ? Math.cos(p.car.angle) * p.car.speed * lead : 0);
    const baseY = p.y + (p.car ? Math.sin(p.car.angle) * p.car.speed * lead : 0);
    const sideAngle = (p.car ? p.car.angle : p.angle) + Math.PI / 2;
    const tx = baseX + Math.cos(sideAngle) * flank;
    const ty = baseY + Math.sin(sideAngle) * flank;
    driveToward(world, car, tx, ty, car.ai.targetSpeed, dt);
    return;
  }
  cruise(world, car, dt, (w, c, index) => {
    // At this intersection, score going straight against turning each way by the distance
    // each exit leaves between the cruiser and the player.
    const along = c.ai.axis === 'x' ? STREET_X : STREET_Y;
    const cross = c.ai.axis === 'x' ? STREET_Y : STREET_X;
    const ix = c.ai.axis === 'x' ? along[index] : cross[c.ai.street];
    const iy = c.ai.axis === 'x' ? cross[c.ai.street] : along[index];
    const exits = [0, 1, -1];
    let best = 0;
    let bestScore = Infinity;
    for (const exit of exits) {
      let ex = ix;
      let ey = iy;
      if (exit === 0) {
        if (c.ai.axis === 'x') ex += c.ai.dir * 150;
        else ey += c.ai.dir * 150;
      } else if (c.ai.axis === 'x') ey += exit * 150;
      else ex += exit * 150;
      const score = Math.hypot(w.player.x - ex, w.player.y - ey) + (exit !== 0 ? 12 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = exit;
      }
    }
    return best;
  });
}

/** Advance every AI-driven car one step: traffic cruises, police hunt. */
export function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.driver !== 'ai') continue;
    if (car.health <= -40) {
      car.throttle = 0;
      continue;
    }
    if (car.kind === 'police') stepPolice(world, car, dt);
    else cruise(world, car, dt, trafficTurn);
    const impact = integrateCar(world, car, dt);
    if (impact > 150 && car.kind === 'police') burst(world, car.x, car.y, 'smoke', 3, '#555a66');
    if (car.health < 25 && world.random() < 0.3) burst(world, car.x, car.y - 4, 'smoke', 1, '#3c4048');
  }
}

/** Sidewalk walking: a pedestrian loops the pavement around their block, corner to corner. */
function walkTarget(ped) {
  const b = ped.block;
  const inset = 10;
  const x0 = b.x + inset;
  const y0 = b.y + inset;
  const x1 = b.x + b.size - inset;
  const y1 = b.y + b.size - inset;
  if (ped.side === 0) return { x: x0 + ped.t * (x1 - x0), y: y0 };
  if (ped.side === 1) return { x: x1, y: y0 + ped.t * (y1 - y0) };
  if (ped.side === 2) return { x: x1 - ped.t * (x1 - x0), y: y1 };
  return { x: x0, y: y1 - ped.t * (y1 - y0) };
}

export function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'flee';
        ped.panic = 1.6;
        ped.health = 30;
      }
      continue;
    }
    // Danger sense: a fast car bearing down, or standing panic, sends them running.
    let threat = null;
    for (const car of world.cars) {
      if (Math.abs(car.speed) < 130) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 52) {
        threat = car;
        break;
      }
    }
    if (threat) {
      ped.state = 'flee';
      ped.panic = 1.4;
    }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const from = threat ?? world.threat ?? world.player;
      const away = Math.atan2(ped.y - from.y, ped.x - from.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 225 * dt;
      ped.y += Math.sin(away) * 225 * dt;
      const clamped = clampWorld(ped.x, ped.y, 14);
      ped.x = clamped.x;
      ped.y = clamped.y;
      if (ped.panic <= 0) {
        ped.state = 'walk';
        // Join the nearest block's pavement loop from wherever the run ended.
        let best = null;
        let bestD = Infinity;
        for (const block of world.city.blocks) {
          const d = Math.hypot(block.x + block.size / 2 - ped.x, block.y + block.size / 2 - ped.y);
          if (d < bestD) {
            bestD = d;
            best = block;
          }
        }
        ped.block = best;
        ped.side = 0;
        ped.t = 0;
      }
      continue;
    }
    // Stroll: advance along the current pavement side, then turn the corner.
    const target = walkTarget(ped);
    const dx = target.x - ped.x;
    const dy = target.y - ped.y;
    const d = Math.hypot(dx, dy);
    const speed = 62;
    if (d < 4) {
      ped.side = (ped.side + 1) % 4;
      ped.t = 0;
      if (world.random() < 0.1) ped.side = Math.floor(world.random() * 4);
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / d) * speed * dt;
      ped.y += (dy / d) * speed * dt;
    }
  }
}
