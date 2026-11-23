// Everything the player sees: the city from a chase camera, its traffic and crowds, the HUD
// with its minimap, and the screens that frame the game. Port Solenne is painted in a
// sun-soaked sunset palette that slides through dusk into neon night and back, with long
// building shadows, lit windows after dark, headlight cones and a soft vignette.
import { FONT, PALETTE, ROAD, STREET_X, STREET_Y, VIEW, WORLD } from './config.js';
import { DISTRICT } from './city.js';
import { missionBanner } from './missions.js';
import { wantedStars } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

/** How dark the world is at a clock time (minutes): 0 at noon, 1 in the small hours. */
function darkness(clock) {
  if (clock < 300) return 1;
  if (clock < 390) return 1 - (clock - 300) / 90 * 0.75; // dawn eases in
  if (clock < 1050) return 0.12;
  if (clock < 1170) return 0.12 + (clock - 1050) / 120 * 0.62; // sunset deepens
  if (clock < 1290) return 0.74 + (clock - 1170) / 120 * 0.26;
  return 1;
}

/** The fullscreen tint that sells the hour: golden at dusk, indigo at night. */
function tintFor(clock) {
  if (clock >= 1020 && clock < 1140) return 'rgba(255, 122, 61, 0.10)'; // sunset wash
  if (clock >= 1140 && clock < 1260) return 'rgba(112, 62, 160, 0.20)'; // violet dusk
  const d = darkness(clock);
  return `rgba(10, 14, 44, ${(d * 0.34).toFixed(3)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(world) {
    const city = world.city;
    const x0 = Math.max(0, camera.x - 40);
    const y0 = Math.max(0, camera.y - 40);
    const x1 = Math.min(WORLD.width, camera.x + VIEW.width + 40);
    const y1 = Math.min(WORLD.height, camera.y + VIEW.height + 40);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Sand, then the sea with slow wave lines.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, city.beachX), y0, Math.min(x1, city.waterX) - Math.max(x0, city.beachX), y1 - y0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(x0, city.waterX), y0, x1 - Math.max(x0, city.waterX), y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    const wavePhase = (world.time * 22) % 46;
    for (let wy = Math.floor(y0 / 46) * 46 + wavePhase - 46; wy < y1; wy += 46) {
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, city.waterX) + 8, wy);
      ctx.lineTo(x1 - 6, wy);
      ctx.stroke();
    }
    // Blocks: a pavement slab, then the district's own ground inside it.
    for (const block of world.city.blocks) {
      if (block.x + block.size < x0 || block.x > x1 || block.y + block.size < y0 || block.y > y1) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(block.x, block.y, block.size, block.size);
      ctx.fillStyle = block.district === DISTRICT.DOCKS ? PALETTE.dock
        : block.district === DISTRICT.BEACH ? PALETTE.sand
          : block.district === DISTRICT.DOWNTOWN ? PALETTE.plaza
            : block.district === DISTRICT.PARK ? PALETTE.grassDark : PALETTE.grass;
      ctx.fillRect(block.x + 14, block.y + 14, block.size - 28, block.size - 28);
    }
    // Roads: asphalt bands, then dashes and crosswalks.
    ctx.fillStyle = PALETTE.asphalt;
    for (const sx of STREET_X) ctx.fillRect(sx - ROAD / 2, 0, ROAD, WORLD.height);
    for (const sy of STREET_Y) ctx.fillRect(0, sy - ROAD / 2, WORLD.width, ROAD);
    ctx.fillStyle = PALETTE.asphaltDark;
    for (const sx of STREET_X) for (const sy of STREET_Y) ctx.fillRect(sx - ROAD / 2, sy - ROAD / 2, ROAD, ROAD);
    ctx.fillStyle = PALETTE.laneMark;
    for (const sx of STREET_X) {
      for (let y = 14; y < WORLD.height; y += 44) {
        if (STREET_Y.some((sy) => Math.abs(y - sy) < ROAD / 2 + 12)) continue;
        ctx.fillRect(sx - 2, y, 4, 24);
      }
    }
    for (const sy of STREET_Y) {
      for (let x = 14; x < WORLD.width; x += 44) {
        if (STREET_X.some((sx) => Math.abs(x - sx) < ROAD / 2 + 12)) continue;
        ctx.fillRect(x, sy - 2, 24, 4);
      }
    }
    ctx.fillStyle = PALETTE.crosswalk;
    for (const sx of STREET_X) {
      for (const sy of STREET_Y) {
        // Zebra bands on all four approaches: bars across each road, just outside the box.
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(sx - 46 + i * 19, sy - ROAD / 2 - 17, 11, 13);
          ctx.fillRect(sx - 46 + i * 19, sy + ROAD / 2 + 4, 11, 13);
          ctx.fillRect(sx - ROAD / 2 - 17, sy - 46 + i * 19, 13, 11);
          ctx.fillRect(sx + ROAD / 2 + 4, sy - 46 + i * 19, 13, 11);
        }
      }
    }
  }

  function drawProps(world, dark) {
    for (const prop of world.city.props) {
      if (prop.x < camera.x - 60 || prop.x > camera.x + VIEW.width + 60 || prop.y < camera.y - 60 || prop.y > camera.y + VIEW.height + 60) continue;
      if (prop.kind === 'palm' || prop.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 7, prop.y + 9, 13, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(prop.x - 2, prop.y - 4, 4, 12);
        ctx.fillStyle = prop.color;
        for (let i = 0; i < 6; i += 1) {
          const a = prop.angle + (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(prop.x + Math.cos(a) * 10, prop.y - 6 + Math.sin(a) * 6, 13, 4.6, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (prop.kind === 'container') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(prop.x + 4, prop.y + 5, 52, 22);
        ctx.fillStyle = prop.color;
        ctx.fillRect(prop.x, prop.y, 52, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (let r = 6; r < 50; r += 9) ctx.fillRect(prop.x + r, prop.y + 2, 3, 18);
      } else if (prop.kind === 'lamp') {
        ctx.fillStyle = prop.color;
        ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
        if (dark > 0.45) {
          const glow = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 30);
          glow.addColorStop(0, 'rgba(255, 205, 110, 0.5)');
          glow.addColorStop(1, 'rgba(255, 205, 110, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(prop.x - 30, prop.y - 30, 60, 60);
        }
      } else if (prop.kind === 'lighthouse') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 8, prop.y + 12, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8e3d5';
        ctx.fillRect(prop.x - 10, prop.y - 26, 20, 38);
        ctx.fillStyle = PALETTE.policeRed;
        ctx.fillRect(prop.x - 10, prop.y - 16, 20, 8);
        ctx.fillRect(prop.x - 10, prop.y + 0, 20, 8);
        if (dark > 0.3) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const beam = ctx.createLinearGradient(prop.x, prop.y - 22, prop.x + 190, prop.y - 60);
          beam.addColorStop(0, 'rgba(255, 240, 180, 0.35)');
          beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(prop.x, prop.y - 24);
          ctx.lineTo(prop.x + 190, prop.y - 74);
          ctx.lineTo(prop.x + 190, prop.y + 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawBuildings(world, dark) {
    for (const b of world.city.buildings) {
      if (b.x + b.w < camera.x - 60 || b.x > camera.x + VIEW.width + 60 || b.y + b.h < camera.y - 60 || b.y > camera.y + VIEW.height + 60) continue;
      const lift = Math.min(26, b.height * 0.16);
      // Long sunset shadow first, then the walls, then the roof stepped toward the light.
      ctx.fillStyle = 'rgba(20, 10, 30, 0.28)';
      ctx.fillRect(b.x + lift * 1.4, b.y + lift * 1.1, b.w, b.h);
      ctx.fillStyle = shade(b.color, -28);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - lift * 0.4, b.y - lift * 0.4, b.w, b.h);
      ctx.fillStyle = shade(b.color, 26);
      ctx.fillRect(b.x - lift * 0.4 + 4, b.y - lift * 0.4 + 4, b.w - 8, b.h - 8);
      if (b.kind === 'house' || b.kind === 'hut') {
        // A pitched roof read from above: a ridge line and a shaded eave border.
        ctx.strokeStyle = shade(b.color, -44);
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - lift * 0.4 + 5, b.y - lift * 0.4 + 5, b.w - 10, b.h - 10);
        ctx.strokeStyle = shade(b.color, -30);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        if (b.w >= b.h) {
          ctx.moveTo(b.x - lift * 0.4 + 7, b.y - lift * 0.4 + b.h / 2);
          ctx.lineTo(b.x - lift * 0.4 + b.w - 7, b.y - lift * 0.4 + b.h / 2);
        } else {
          ctx.moveTo(b.x - lift * 0.4 + b.w / 2, b.y - lift * 0.4 + 7);
          ctx.lineTo(b.x - lift * 0.4 + b.w / 2, b.y - lift * 0.4 + b.h - 7);
        }
        ctx.stroke();
      }
      if (b.kind === 'tower' || b.kind === 'warehouse') {
        // Window grid: sparse and irregular, dark by day, warming up lit after dark.
        const cols = Math.max(2, Math.floor(b.w / 24));
        const rows = Math.max(2, Math.floor(b.h / 24));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const hash = (cx * 31 + cy * 57 + b.x * 3 + b.y) % 9;
            if (hash === 4) continue; // a dark, empty office
            ctx.fillStyle = hash === 0 && dark > 0.4 ? 'rgba(255, 196, 86, 0.95)' : 'rgba(24, 30, 44, 0.5)';
            ctx.fillRect(b.x - lift * 0.4 + 9 + cx * 24, b.y - lift * 0.4 + 9 + cy * 24, 9, 11);
          }
        }
      }
    }
  }

  function shade(hex, amt) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawCar(world, car, dark) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    roundRect(ctx, -20, -8, 46, 22, 7);
    ctx.fill();
    const isPolice = car.kind === 'police';
    ctx.fillStyle = isPolice ? '#eef0f4' : car.color;
    roundRect(ctx, -23, -11, 46, 22, 6);
    ctx.fill();
    if (isPolice) {
      ctx.fillStyle = PALETTE.policeBlue;
      ctx.fillRect(-23, -3.5, 46, 7);
      // Light bar: red and blue halves trading flashes twice a second.
      const phase = Math.floor(world.time * 4 + car.siren) % 2;
      ctx.fillStyle = phase === 0 ? '#ff4444' : '#662222';
      ctx.fillRect(-6, -7, 6, 14);
      ctx.fillStyle = phase === 0 ? '#224488' : '#4488ff';
      ctx.fillRect(1, -7, 6, 14);
    }
    ctx.fillStyle = shade(isPolice ? '#eef0f4' : car.color, -34);
    roundRect(ctx, -12, -8.5, 21, 17, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(16, 22, 34, 0.85)';
    roundRect(ctx, 2, -7.5, 7, 15, 2); // windshield
    ctx.fill();
    ctx.fillRect(-11, -7, 4, 14); // rear window
    ctx.fillStyle = '#20242c';
    for (const [wx, wy] of [[-15, -12], [13, -12], [-15, 9], [13, 9]]) ctx.fillRect(wx, wy, 8, 4);
    if (dark > 0.42) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(23, 0, 120, 0);
      beam.addColorStop(0, 'rgba(255, 236, 170, 0.30)');
      beam.addColorStop(1, 'rgba(255, 236, 170, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(23, -7);
      ctx.lineTo(122, -24);
      ctx.lineTo(122, 24);
      ctx.lineTo(23, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(21, -8, 3, 4);
      ctx.fillRect(21, 4, 3, 4);
    }
    if (car === world.player.car) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2.4;
      roundRect(ctx, -26, -14, 52, 28, 9);
      ctx.stroke();
      ctx.fillStyle = 'rgba(242, 201, 76, 0.20)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 34, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.health < 30) {
      ctx.fillStyle = 'rgba(30,30,34,0.5)';
      ctx.beginPath();
      ctx.arc(car.x + 12, car.y - 4, 6 + (world.time * 7 % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-11, 3, 22, 7);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-10, -3, 20, 6);
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath();
      ctx.arc(13, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath();
    ctx.arc(2.5, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(world) {
    const p = world.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 9, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    // Marlo's teal jacket and the arm that throws the punch.
    ctx.fillStyle = '#1f8a8c';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    const punching = p.punchTimer > 0.18;
    ctx.fillStyle = '#e8b98d';
    ctx.fillRect(7, -2.4, punching ? 13 : 7, 4.8);
    if (p.weapon === 'pistol') {
      ctx.fillStyle = '#22242a';
      ctx.fillRect(9, -1.8, 10, 3.6);
    }
    ctx.restore();
    if (p.hurtFlash > 0) {
      ctx.strokeStyle = `rgba(229, 83, 75, ${(p.hurtFlash * 1.6).toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawObjective(world) {
    const o = world.objective;
    if (!o) return;
    const pulse = 1 + Math.sin(world.time * 5) * 0.16;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242, 201, 76, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.save();
    ctx.translate(0, -44 - Math.sin(world.time * 3.2) * 5);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.restore();
  }

  function drawPickups(world) {
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(world.time * 3 + pickup.x) * 3;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 12 - bob, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pickup.kind === 'health') {
        ctx.fillStyle = '#f2f2f2';
        roundRect(ctx, -11, -11, 22, 22, 5);
        ctx.fill();
        ctx.fillStyle = PALETTE.policeRed;
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (pickup.kind === 'pistol') {
        ctx.fillStyle = '#22242a';
        roundRect(ctx, -12, -6, 24, 9, 2);
        ctx.fill();
        ctx.fillRect(4, 2, 6, 9);
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 1.6;
        roundRect(ctx, -14, -13, 28, 28, 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        text('$', 0, 5.5, 15, '#7a5b12', 'center', 800);
      }
      ctx.restore();
    }
  }

  function drawMinimap(world) {
    const w = 198;
    const h = 162;
    const x = 16;
    const y = VIEW.height - h - 16;
    ctx.save();
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(14, 20, 26, 0.88)';
    ctx.fill();
    ctx.clip();
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.fillStyle = '#274b63';
    ctx.fillRect(x + world.city.waterX * sx, y, w, h);
    ctx.fillStyle = '#3f5a36';
    ctx.fillRect(x, y, world.city.beachX * sx, h);
    ctx.fillStyle = '#e3c188';
    ctx.fillRect(x + world.city.beachX * sx, y, (world.city.waterX - world.city.beachX) * sx, h);
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.5)';
    ctx.lineWidth = 2;
    for (const s of STREET_X) {
      ctx.beginPath();
      ctx.moveTo(x + s * sx, y);
      ctx.lineTo(x + s * sx, y + h);
      ctx.stroke();
    }
    for (const s of STREET_Y) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * sy);
      ctx.lineTo(x + w, y + s * sy);
      ctx.stroke();
    }
    for (const car of world.cars) {
      if (car.kind === 'police') continue;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x + car.x * sx - 1.4, y + car.y * sy - 1.4, 2.8, 2.8);
    }
    const flash = Math.floor(world.time * 3) % 2 === 0;
    for (const car of world.cars) {
      if (car.kind !== 'police') continue;
      ctx.fillStyle = flash ? '#ff5545' : '#4d8dff';
      ctx.beginPath();
      ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (world.objective) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x + world.objective.x * sx, y + world.objective.y * sy, 3.6 + Math.sin(world.time * 5) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = world.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -3.6);
    ctx.lineTo(-4, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
  }

  function drawHud(world, ui) {
    const p = world.player;
    // Health and identity, top left.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 16, 14, 252, 56, 9);
    ctx.fill();
    text('MARLO REYES', 28, 38, 15, PALETTE.text, 'left', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, 28, 46, 168, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 28, 46, 168 * (p.health / 100), 12, 6);
    ctx.fill();
    text(p.weapon === 'pistol' ? `PISTOL · ${p.ammo}` : 'FISTS', 206, 58, 13, PALETTE.textDim, 'left', 700);
    // Cash and wanted stars, top right.
    text(`$${p.cash.toLocaleString('en-US')}`, VIEW.width - 24, 44, 30, PALETTE.gold, 'right', 800);
    const stars = wantedStars(world);
    for (let i = 0; i < 5; i += 1) {
      const sx = VIEW.width - 24 - i * 27;
      text('★', sx, 76, 24, i < stars ? PALETTE.gold : 'rgba(255,255,255,0.22)', 'right', 800);
    }
    if (p.bust > 0.15 && stars > 0) {
      ctx.fillStyle = 'rgba(229, 83, 75, 0.85)';
      roundRect(ctx, VIEW.width / 2 - 90, 92, 180 * Math.min(1, p.bust / 2.6), 9, 4);
      ctx.fill();
      text('BUSTED…', VIEW.width / 2, 88, 15, '#ff7a70', 'center', 800);
    }
    // Chapter banner, top centre.
    const banner = missionBanner(world);
    if (banner && ui.screen === SCREEN_PLAY) {
      ctx.fillStyle = PALETTE.panel;
      const bw = Math.max(340, Math.min(620, banner.line.length * 7.4 + 44));
      roundRect(ctx, VIEW.width / 2 - bw / 2, 12, bw, 52, 9);
      ctx.fill();
      text(banner.title.toUpperCase(), VIEW.width / 2, 33, 12.5, PALETTE.neonCyan, 'center', 800);
      text(banner.line, VIEW.width / 2, 55, 15, PALETTE.text, 'center', 600);
    }
    // Clock and speed, bottom right.
    const hh = String(Math.floor(world.clock / 60)).padStart(2, '0');
    const mm = String(Math.floor(world.clock % 60)).padStart(2, '0');
    text(`${hh}:${mm}`, VIEW.width - 24, VIEW.height - 44, 20, PALETTE.text, 'right', 700);
    if (p.car) {
      text(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, VIEW.width - 24, VIEW.height - 18, 15, PALETTE.textDim, 'right', 600);
    }
    if (ui.muted) text('SOUND OFF (M)', VIEW.width - 24, VIEW.height - 70, 12, PALETTE.textDim, 'right', 600);
    drawMinimap(world);
    // The way to the marker, when it is off-screen: a gold arrow on the screen edge.
    if (world.objective && ui.screen === SCREEN_PLAY) {
      const dx = world.objective.x - p.x;
      const dy = world.objective.y - p.y;
      if (Math.abs(dx) > VIEW.width / 2 || Math.abs(dy) > VIEW.height / 2) {
        const a = Math.atan2(dy, dx);
        const ex = VIEW.width / 2 + Math.cos(a) * (VIEW.width / 2 - 60);
        const ey = VIEW.height / 2 + Math.sin(a) * (VIEW.height / 2 - 60);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-9, -9);
        ctx.lineTo(-9, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(`${Math.round(Math.hypot(dx, dy) / 10)}m`, ex, ey + 26, 13, PALETTE.gold, 'center', 700);
      }
    }
    // Context prompt, bottom centre.
    if (ui.prompt) {
      ctx.fillStyle = PALETTE.panel;
      const pw = ui.prompt.length * 8.4 + 36;
      roundRect(ctx, VIEW.width / 2 - pw / 2, VIEW.height - 118, pw, 34, 8);
      ctx.fill();
      text(ui.prompt, VIEW.width / 2, VIEW.height - 96, 16, PALETTE.text, 'center', 700);
    }
    // Dialogue, above the prompt.
    if (world.dialogue) {
      const line = world.dialogue.lines[world.dialogue.at];
      if (line) {
        ctx.fillStyle = PALETTE.panel;
        roundRect(ctx, VIEW.width / 2 - 330, VIEW.height - 196, 660, 66, 10);
        ctx.fill();
        text(line[0].toUpperCase(), VIEW.width / 2 - 308, VIEW.height - 168, 13, PALETTE.neonPink, 'left', 800);
        text(line[1], VIEW.width / 2 - 308, VIEW.height - 144, 16.5, PALETTE.text, 'left', 500);
      }
    }
  }

  function drawPanel(lines, title, titleColor, prompt) {
    ctx.fillStyle = 'rgba(8, 8, 16, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 700;
    const h = 120 + lines.length * 30 + 66;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    text(title, VIEW.width / 2, y + 72, 44, titleColor, 'center', 800);
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 116 + i * 30, 17.5, PALETTE.textDim, 'center', 500));
    if (prompt) text(prompt, VIEW.width / 2, y + h - 26, 17, PALETTE.gold, 'center', 700);
  }

  function drawTitle(world, ui) {
    // The city drifts behind the title: a slow pan across downtown at sunset.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(20, 8, 34, 0.25)');
    grad.addColorStop(0.55, 'rgba(20, 8, 34, 0.05)');
    grad.addColorStop(1, 'rgba(20, 8, 34, 0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = 'rgba(10, 8, 22, 0.42)';
    roundRect(ctx, VIEW.width / 2 - 430, 128, 860, 452, 18);
    ctx.fill();
    text('VELVET TIDE', VIEW.width / 2, 218, 92, PALETTE.text, 'center', 800);
    text('P O R T   S O L E N N E', VIEW.width / 2, 262, 26, PALETTE.neonCyan, 'center', 700);
    text('Marlo Reyes swore he was done driving for other people.', VIEW.width / 2, 316, 19, PALETTE.text, 'center', 500);
    text('Then Auntie Vi called in six years of dinners.', VIEW.width / 2, 344, 19, PALETTE.text, 'center', 500);
    const controls = [
      'WASD / arrows — walk & drive      Shift — run      E — enter / exit car',
      'Mouse — aim      Click / J — punch & shoot      P — pause      M — sound',
      'Follow the gold marker. Five chapters. One long goodbye.',
    ];
    controls.forEach((line, i) => text(line, VIEW.width / 2, 420 + i * 28, 16.5, PALETTE.textDim, 'center', 500));
    text(ui.saveExists ? 'Press Enter for a new game · C to continue' : 'Press Enter to begin', VIEW.width / 2, 540, 21, PALETTE.gold, 'center', 800);
    void world;
  }

  /** Paint one frame: world first (unless a full screen covers it), then HUD and panels. */
  function draw(world, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    const p = world.player;
    if (ui.screen === SCREEN_TITLE) {
      // A slow cinematic pan for the title backdrop.
      camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, 900 + Math.sin(world.time * 0.05) * 420));
      camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, 700 + Math.cos(world.time * 0.037) * 300));
    } else {
      camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
      camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
    }
    const dark = darkness(world.clock);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGround(world);
    drawProps(world, dark);
    if (ui.screen !== SCREEN_TITLE) {
      drawPickups(world);
      drawObjective(world);
    }
    for (const ped of world.peds) drawPed(ped);
    const sortedCars = [...world.cars].sort((a, b) => a.y - b.y);
    for (const car of sortedCars) drawCar(world, car, dark);
    drawPlayer(world);
    ctx.fillStyle = '#ffe9a8';
    for (const b of world.bullets) ctx.fillRect(b.x - 3, b.y - 1.4, 6, 2.8);
    for (const pt of world.particles) {
      const lifeT = pt.life / pt.maxLife;
      ctx.globalAlpha = pt.kind === 'smoke' ? 0.34 * (1 - lifeT) : 1 - lifeT;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? 1 + lifeT : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawBuildings(world, dark);
    ctx.restore();

    // The hour's tint, then the vignette.
    ctx.fillStyle = tintFor(world.clock);
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const vig = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200, 30, 30, ${(p.hurtFlash * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (ui.screen === SCREEN_TITLE) {
      drawTitle(world, ui);
      return;
    }
    drawHud(world, ui);
    if (ui.screen === SCREEN_PAUSED) {
      drawPanel(['The tide waits for no one. Except now.'], 'PAUSED', PALETTE.text, 'Press P to keep driving');
    } else if (ui.screen === SCREEN_OVER) {
      const busted = ui.overReason === 'busted';
      drawPanel(
        busted
          ? ['The Solenne PD walk Marlo to a cell.', 'Bail and "fees" come out of his pocket.', `Cash left: $${p.cash.toLocaleString('en-US')}`]
          : ['Marlo wakes up at Solenne General, stitched and billed.', 'The city kept his car. The hospital kept his cash.', `Cash left: $${p.cash.toLocaleString('en-US')}`],
        busted ? 'BUSTED' : 'WASTED',
        '#ff7a70',
        'Press Enter to carry on',
      );
    } else if (ui.screen === SCREEN_COMPLETE) {
      drawPanel(
        [
          'Vi watches the lighthouse turn, and Port Solenne is Marlo\'s again.',
          `Earned across five chapters: $${world.stats.earned.toLocaleString('en-US')}`,
          `Cars borrowed: ${world.stats.stolen} · Pedestrians inconvenienced: ${world.stats.hits}`,
          'The city stays open — roam it, race it, keep it warm.',
        ],
        'THE LONG GOODBYE — COMPLETE',
        PALETTE.gold,
        'Press Enter to keep roaming',
      );
    }
  }

  return { draw, camera };
}
