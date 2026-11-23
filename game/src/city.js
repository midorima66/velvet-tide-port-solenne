// The city of Port Solenne: a street grid on a coast, generated once from a seed. Blocks
// between the streets belong to districts — downtown towers in the middle, warehouses on the
// southern docks, houses in the suburbs, sand and palms on the eastern beach — and every block
// is filled with buildings whose rectangles are the world's collision and the renderer's city.
// Named places (the diner, the docks, the chop shop…) anchor the story's missions.
import { LANE, PITCH, ROAD, STREET_X, STREET_Y, WORLD } from './config.js';
import { pick, randInt } from './random.js';

export const DISTRICT = { DOWNTOWN: 0, SUBURB: 1, DOCKS: 2, BEACH: 3, PARK: 4 };

const TOWER_COLORS = ['#8d99ae', '#a26769', '#5e60ce', '#7f5539', '#606c38', '#9c6644', '#4a4e69', '#bc6c25'];
const HOUSE_COLORS = ['#e9d8a6', '#f4a261', '#e5989b', '#b7b7a4', '#a3b18a', '#ffb4a2', '#90e0a8', '#f2cc8f'];
const WAREHOUSE_COLORS = ['#7d8597', '#979dac', '#5c677d', '#6d6875'];

/** Which district a block column/row belongs to: the map's character comes from this table. */
function districtOf(col, row) {
  if (row === STREET_Y.length - 2) return DISTRICT.DOCKS;
  if (col === STREET_X.length - 2) return DISTRICT.BEACH;
  if (col >= 2 && col <= 4 && row >= 1 && row <= 3) return DISTRICT.DOWNTOWN;
  if (col === 3 && row === 0) return DISTRICT.PARK;
  return DISTRICT.SUBURB;
}

/** The named places the story uses, each on the street outside the venue it names. */
export function namedPlaces() {
  return {
    diner: { name: 'Tidewater Diner', x: STREET_X[3] - 30, y: STREET_Y[2] + 120 },
    docks: { name: 'South Docks, Berth 9', x: STREET_X[5], y: STREET_Y[5] - 40 },
    chopShop: { name: "Rook's Chop Shop", x: STREET_X[1] + 30, y: STREET_Y[4] - 120 },
    gunStore: { name: 'Harbor Arms', x: STREET_X[4] + 30, y: STREET_Y[1] - 120 },
    hospital: { name: 'Solenne General', x: STREET_X[2] - 30, y: STREET_Y[0] + 120 },
    policeStation: { name: 'Solenne PD', x: STREET_X[5] + 30, y: STREET_Y[2] + 120 },
    lighthouse: { name: 'Gull Rock Lighthouse', x: WORLD.width - 160, y: STREET_Y[0] + 60 },
    marina: { name: 'Velvet Marina', x: STREET_X[6] - 30, y: STREET_Y[4] + 120 },
    hotel: { name: 'The Velvetine Hotel', x: STREET_X[4] - 30, y: STREET_Y[3] - 120 },
    depot: { name: 'Old Bus Depot', x: STREET_X[0] + 30, y: STREET_Y[3] + 120 },
  };
}

function addBuilding(city, x, y, w, h, height, color, kind) {
  const building = { x, y, w, h, height, color, kind };
  city.buildings.push(building);
  city.solids.push(building);
  return building;
}

/** Fill one block with buildings that fit its district, leaving a sidewalk margin all round. */
function fillBlock(city, random, bx, by, size, district) {
  const m = 20; // sidewalk margin inside the block
  const x0 = bx + m;
  const y0 = by + m;
  const inner = size - m * 2;
  if (district === DISTRICT.DOWNTOWN) {
    if (random() < 0.55) {
      addBuilding(city, x0 + 14, y0 + 14, inner - 28, inner - 28, randInt(random, 90, 190), pick(random, TOWER_COLORS), 'tower');
    } else {
      const w = (inner - 16) / 2;
      addBuilding(city, x0, y0, w, inner, randInt(random, 60, 120), pick(random, TOWER_COLORS), 'tower');
      addBuilding(city, x0 + w + 16, y0, w, inner, randInt(random, 60, 130), pick(random, TOWER_COLORS), 'tower');
    }
  } else if (district === DISTRICT.DOCKS) {
    addBuilding(city, x0, y0 + 10, inner, inner * 0.52, 34, pick(random, WAREHOUSE_COLORS), 'warehouse');
    for (let i = 0; i < 5; i += 1) {
      city.props.push({ kind: 'container', x: x0 + 8 + random() * (inner - 60), y: y0 + inner * 0.66 + random() * 34, angle: 0, color: pick(random, ['#c1554e', '#4e7dc1', '#57a773', '#dd8a3c']) });
    }
  } else if (district === DISTRICT.BEACH) {
    if (random() < 0.7) addBuilding(city, x0 + 30, y0 + 26, 92, 70, 20, pick(random, HOUSE_COLORS), 'hut');
    for (let i = 0; i < 6; i += 1) {
      city.props.push({ kind: 'palm', x: bx + 16 + random() * (size - 32), y: by + 16 + random() * (size - 32), angle: random() * 6.28, color: '#3f7d3a' });
    }
  } else if (district === DISTRICT.PARK) {
    for (let i = 0; i < 10; i += 1) {
      city.props.push({ kind: 'tree', x: bx + 24 + random() * (size - 48), y: by + 24 + random() * (size - 48), angle: random() * 6.28, color: '#3c6e35' });
    }
  } else {
    const w = (inner - 18) / 2;
    const h = (inner - 18) / 2;
    for (let gx = 0; gx < 2; gx += 1) {
      for (let gy = 0; gy < 2; gy += 1) {
        if (random() < 0.88) addBuilding(city, x0 + gx * (w + 18), y0 + gy * (h + 18), w, h, randInt(random, 16, 26), pick(random, HOUSE_COLORS), 'house');
      }
    }
    city.props.push({ kind: 'tree', x: bx + 8 + random() * 30, y: by + 8 + random() * 30, angle: 0, color: '#48783e' });
  }
}

/** Build the whole city: blocks, buildings, props, plus the beach and harbour ground strips. */
export function createCity(random) {
  const city = {
    buildings: [],
    solids: [],
    props: [],
    blocks: [],
    places: namedPlaces(),
    // Sand begins where the beach blocks begin and runs east to the waterline.
    beachX: STREET_X[STREET_X.length - 2] + ROAD / 2,
    waterX: WORLD.width - 130,
  };
  const size = PITCH - ROAD;
  for (let col = 0; col < STREET_X.length - 1; col += 1) {
    for (let row = 0; row < STREET_Y.length - 1; row += 1) {
      const bx = STREET_X[col] + ROAD / 2;
      const by = STREET_Y[row] + ROAD / 2;
      const district = districtOf(col, row);
      city.blocks.push({ x: bx, y: by, size, district });
      fillBlock(city, random, bx, by, size, district);
    }
  }
  // Street lamps along every intersection corner and palms along the beach promenade.
  for (const sx of STREET_X) {
    for (const sy of STREET_Y) {
      city.props.push({ kind: 'lamp', x: sx - ROAD / 2 - 8, y: sy - ROAD / 2 - 8, angle: 0, color: '#2f3542' });
      city.props.push({ kind: 'lamp', x: sx + ROAD / 2 + 8, y: sy + ROAD / 2 + 8, angle: 0, color: '#2f3542' });
    }
  }
  for (let y = 120; y < WORLD.height - 80; y += 130) {
    city.props.push({ kind: 'palm', x: city.waterX - 46, y, angle: random() * 6.28, color: '#3f7d3a' });
  }
  // The lighthouse stands on the sand at the north-east corner, by the waterline.
  city.props.push({ kind: 'lighthouse', x: WORLD.width - 160, y: STREET_Y[0] + 60, angle: 0, color: '#e8e3d5' });
  return city;
}

/** The lane centre a car drives on: street index and travel direction give the offset side. */
export function laneCoordinate(streetCentre, dir, axis) {
  // Right-hand traffic: eastbound and southbound lanes sit on the positive side of the centre
  // for one axis and the negative for the other, so a car always keeps the kerb on its right.
  if (axis === 'x') return streetCentre + (dir > 0 ? LANE : -LANE);
  return streetCentre + (dir > 0 ? -LANE : LANE);
}

/** True when the point is on a road (either street band), false on blocks and ground. */
export function onRoad(x, y) {
  for (const sx of STREET_X) if (Math.abs(x - sx) <= ROAD / 2) return true;
  for (const sy of STREET_Y) if (Math.abs(y - sy) <= ROAD / 2) return true;
  return false;
}

/** Push a circle at (x, y) out of every solid rectangle; returns the corrected position. */
export function resolveCircle(city, x, y, radius) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const s of city.solids) {
      const nx = Math.max(s.x, Math.min(x, s.x + s.w));
      const ny = Math.max(s.y, Math.min(y, s.y + s.h));
      let dx = x - nx;
      let dy = y - ny;
      let d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      if (d2 < 0.0001) {
        // Centre inside the rectangle: leave by the shallowest side.
        const left = x - s.x;
        const right = s.x + s.w - x;
        const top = y - s.y;
        const bottom = s.y + s.h - y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = s.x - radius;
        else if (min === right) x = s.x + s.w + radius;
        else if (min === top) y = s.y - radius;
        else y = s.y + s.h + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * radius;
      y = ny + (dy / d) * radius;
      dx = x - nx;
      dy = y - ny;
      d2 = dx * dx + dy * dy;
    }
  }
  return { x, y };
}

/** True when the circle overlaps any solid rectangle (a cheap "is this spot blocked" test). */
export function circleBlocked(city, x, y, radius) {
  for (const s of city.solids) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** Clamp a position to the world, keeping a margin so nothing leaves Port Solenne. */
export function clampWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD.width - margin, x)),
    y: Math.max(margin, Math.min(WORLD.height - margin, y)),
  };
}
