// Velvet Tide: Port Solenne — every tuning number, colour and name in one place.
// The view is a fixed 1280x720 logical area that the renderer scales to the window; the world
// itself is a much larger coastal city measured in the same pixels.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Streets: vertical street centres run west to east, horizontal ones north to south. */
export const ROAD = 108;
export const PITCH = 360;
export const STREET_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const STREET_Y = [180, 540, 900, 1260, 1620, 1980];
export const WORLD = { width: 2880, height: 2340 };

/** Lane offset from a street centre for right-hand traffic. */
export const LANE = 27;

export const PLAYER = {
  radius: 11,
  walkSpeed: 155,
  runSpeed: 262,
  health: 100,
  punchRange: 30,
  punchDamage: 34,
  punchCooldown: 0.34,
};

export const CAR = {
  length: 46,
  width: 22,
  radius: 16,
  accel: 265,
  brake: 430,
  reverse: 120,
  drag: 0.55,
  grip: 3.4,
  parkedChance: 0.55,
};

/** Traffic and police population targets. */
export const POP = {
  trafficCars: 26,
  parkedCars: 34,
  pedestrians: 42,
  policePerStar: 2,
  policeMax: 9,
};

/** Wanted heat: crimes add points, stars are points // 100, calm time drains them. */
export const HEAT = {
  stealCar: 110,
  hitPedestrian: 210,
  shootNearPolice: 120,
  ramPolice: 90,
  hitAndRun: 60,
  decayPerSecond: 3.2,
  decayWhenHidden: 11,
  bustedSeconds: 2.6,
};

export const WEAPON = {
  fist: { name: 'Fists', damage: 34, range: 30, cooldown: 0.34 },
  pistol: { name: 'Pistol', damage: 55, range: 460, cooldown: 0.24, speed: 880 },
};

/** One game minute passes per real second; the city opens at golden hour, 17:40. */
export const CLOCK = { start: 17 * 60 + 40, minutesPerSecond: 1 };

export const SAVE_KEY = 'velvet-tide.port-solenne.save.v1';

export const CITY_NAME = 'Port Solenne';
export const GAME_TITLE = 'VELVET TIDE';
export const HERO_NAME = 'Marlo Reyes';

export const PALETTE = {
  asphalt: '#3c3f4a',
  asphaltDark: '#33363f',
  laneMark: '#d8c98a',
  crosswalk: '#cfd3da',
  sidewalk: '#9aa0a8',
  sidewalkEdge: '#7e858f',
  grass: '#5d8a4e',
  grassDark: '#527a44',
  sand: '#e3c188',
  sandWet: '#d4af74',
  water: '#2e6f8e',
  waterDeep: '#256380',
  dock: '#8d8578',
  plaza: '#b0a696',
  roofLight: '#c9ccd4',
  text: '#f5efe2',
  textDim: '#b9b2a2',
  gold: '#f2c94c',
  neonPink: '#ff5d8f',
  neonCyan: '#53e0d4',
  policeBlue: '#3a6fd8',
  policeRed: '#e5534b',
  health: '#7dd069',
  healthLow: '#e5534b',
  panel: 'rgba(16, 18, 28, 0.82)',
  vignette: 'rgba(10, 6, 18, 0.42)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Car paint jobs for traffic, parked cars and the player's rides. */
export const CAR_COLORS = [
  '#c94f4f', '#4f7dc9', '#e0a83c', '#5da85f', '#d8d8d8', '#7a4fc9',
  '#3fbfae', '#e2703a', '#8a93a5', '#d45f9e', '#4361ee', '#bc6c25',
];

export const PED_COLORS = [
  '#e8e3d5', '#30475e', '#a63d40', '#3d6ea5', '#588157', '#e9c46a',
  '#6d597a', '#f4a261', '#2a9d8f', '#bc4749', '#495057', '#ffb4a2',
];
