const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const panel = document.querySelector('#panel');
const startBtn = document.querySelector('#startBtn');
const newSeedBtn = document.querySelector('#newSeedBtn');
const distanceEl = document.querySelector('#distance');
const seedEl = document.querySelector('#seedLabel');
const bpmEl = document.querySelector('#bpmLabel');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js');
}

const state = {
  running: false,
  dead: false,
  dpr: 1,
  width: 0,
  height: 0,
  time: 0,
  lastTime: 0,
  distance: 0,
  groundY: 0,
  seed: 7319,
  stage: null,
  player: { x: 110, y: 0, size: 42, vy: 0, grounded: true, rotation: 0 },
  obstacles: [],
  generatedBeats: new Set()
};

const fallbackStage = {
  id: 'fallback',
  name: 'Fallback',
  bpm: 120,
  gravity: 2350,
  jumpVelocity: 850,
  speed: 380,
  seed: 7319,
  palette: {
    skyTop: '#10164d',
    skyBottom: '#08091a',
    ground: '#171a3b',
    grid: '#2ff3ff',
    player: '#ffe84a',
    obstacle: '#ff3d7f'
  }
};

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadStage() {
  try {
    const response = await fetch('data/stages.json', { cache: 'no-store' });
    const data = await response.json();
    return data.stages.find((stage) => stage.id === data.defaultStage) ?? data.stages[0] ?? fallbackStage;
  } catch {
    return fallbackStage;
  }
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.groundY = Math.round(state.height * 0.72);
  state.player.y = Math.min(state.player.y || state.groundY - state.player.size, state.groundY - state.player.size);
}

function reset(seed = state.stage.seed) {
  state.running = false;
  state.dead = false;
  state.time = 0;
  state.lastTime = 0;
  state.distance = 0;
  state.seed = seed;
  state.obstacles = [];
  state.generatedBeats.clear();
  state.player = { x: 110, y: state.groundY - 42, size: 42, vy: 0, grounded: true, rotation: 0 };
  seedEl.textContent = String(state.seed);
  bpmEl.textContent = String(state.stage.bpm);
  distanceEl.textContent = '0m';
  panel.classList.remove('hidden');
}

function start() {
  if (state.dead) reset(state.seed);
  state.running = true;
  state.dead = false;
  panel.classList.add('hidden');
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function jump() {
  if (!state.running) return;
  if (state.player.grounded) {
    state.player.vy = -state.stage.jumpVelocity;
    state.player.grounded = false;
  }
}

function obstacleForBeat(beat) {
  const random = mulberry32(state.seed + beat * 1013);
  if (beat < 4 || random() < 0.38) return null;
  const size = 34 + Math.floor(random() * 26);
  return {
    x: state.width + size,
    y: state.groundY - size,
    width: size,
    height: size,
    beat
  };
}

function generateObstacles() {
  const beatSeconds = 60 / state.stage.bpm;
  const currentBeat = Math.floor((state.time + 2.5) / beatSeconds);
  for (let beat = Math.max(0, currentBeat - 3); beat <= currentBeat + 7; beat += 1) {
    if (state.generatedBeats.has(beat)) continue;
    state.generatedBeats.add(beat);
    const obstacle = obstacleForBeat(beat);
    if (obstacle) state.obstacles.push(obstacle);
  }
}

function update(dt) {
  const player = state.player;
  const stage = state.stage;

  state.time += dt;
  state.distance += stage.speed * dt * 0.025;
  player.vy += stage.gravity * dt;
  player.y += player.vy * dt;
  player.rotation += (player.grounded ? 0 : 8) * dt;

  if (player.y + player.size >= state.groundY) {
    player.y = state.groundY - player.size;
    player.vy = 0;
    player.grounded = true;
    player.rotation = 0;
  }

  generateObstacles();
  for (const obstacle of state.obstacles) obstacle.x -= stage.speed * dt;
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -80);

  if (state.obstacles.some((obstacle) => intersects(player, obstacle))) {
    state.dead = true;
    state.running = false;
    panel.querySelector('h1').textContent = 'Bateu!';
    panel.querySelector('p').textContent = 'Toque em jogar para tentar a mesma seed de novo, ou gere uma nova fase.';
    panel.classList.remove('hidden');
  }

  distanceEl.textContent = `${Math.floor(state.distance)}m`;
}

function intersects(player, obstacle) {
  const padding = 7;
  return player.x + padding < obstacle.x + obstacle.width &&
    player.x + player.size - padding > obstacle.x &&
    player.y + padding < obstacle.y + obstacle.height &&
    player.y + player.size - padding > obstacle.y;
}

function draw() {
  const palette = state.stage.palette;
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  drawGrid(palette);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, state.groundY, state.width, state.height - state.groundY);

  for (const obstacle of state.obstacles) drawObstacle(obstacle, palette);
  drawPlayer(palette);
}

function drawGrid(palette) {
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  const offset = -(state.distance * 14) % 48;
  for (let x = offset; x < state.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, state.groundY);
    ctx.lineTo(x + 160, state.height);
    ctx.stroke();
  }
  for (let y = state.groundY; y < state.height; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(palette) {
  const player = state.player;
  ctx.save();
  ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = palette.player;
  ctx.shadowColor = palette.player;
  ctx.shadowBlur = 22;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.restore();
}

function drawObstacle(obstacle, palette) {
  ctx.save();
  ctx.fillStyle = palette.obstacle;
  ctx.shadowColor = palette.obstacle;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
  ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
  ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function loop(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.033);
  state.lastTime = now;
  if (state.running) update(dt);
  draw();
  if (state.running) requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
window.addEventListener('pointerdown', (event) => {
  if (event.target instanceof HTMLButtonElement) return;
  jump();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') jump();
});
startBtn.addEventListener('click', () => {
  panel.querySelector('h1').textContent = 'Reposit Geometry';
  panel.querySelector('p').textContent = 'Protótipo HTML gratuito, feito para celular e individual/offline. Publique no GitHub Pages e jogue pelo navegador do telefone, sem PC e sem pagar hospedagem.';
  start();
});
newSeedBtn.addEventListener('click', () => reset(Math.floor(Math.random() * 900000) + 1000));

state.stage = await loadStage();
resize();
reset(state.stage.seed);
draw();
