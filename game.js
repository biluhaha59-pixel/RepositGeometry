// ============================================================
//  Geometry Clash – game.js
//  Duas faixas | Batidas da música | Round 1 normal, Round 2 difícil
// ============================================================

'use strict';

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js');
}

// ──────────────────────────────────────────────
//  DOM refs
// ──────────────────────────────────────────────
const canvas        = document.querySelector('#game');
const ctx           = canvas.getContext('2d');
const panel         = document.querySelector('#panel');
const panelTitle    = document.querySelector('#panelTitle');
const panelDesc     = document.querySelector('#panelDesc');
const startBtn      = document.querySelector('#startBtn');
const retryBtn      = document.querySelector('#retryBtn');
const resultPanel   = document.querySelector('#resultPanel');
const resultWinner  = document.querySelector('#resultWinner');
const finalScore1   = document.querySelector('#finalScore1');
const finalScore2   = document.querySelector('#finalScore2');
const playAgainBtn  = document.querySelector('#playAgainBtn');
const modeVsBot     = document.querySelector('#modeVsBot');
const modeLocal     = document.querySelector('#modeLocal');
const score1El      = document.querySelector('#score1');
const score2El      = document.querySelector('#score2');
const combo1El      = document.querySelector('#combo1');
const combo2El      = document.querySelector('#combo2');
const roundBadge    = document.querySelector('#roundBadge');
const progressBar1  = document.querySelector('#progressBar1');
const progressBar2  = document.querySelector('#progressBar2');
const progressShip1 = document.querySelector('#progressShip1');
const progressShip2 = document.querySelector('#progressShip2');
const progressPct   = document.querySelector('#progressPct');
const powerupToast  = document.querySelector('#powerupToast');

// ──────────────────────────────────────────────
//  Constantes
// ──────────────────────────────────────────────
const SONG_SRC        = 'audio/gut_genug.mp3';
const SONG_DURATION   = 123.95;   // segundos
const SONG_BPM        = 85;       // gut genug slowed ~85 BPM
const BEAT_SEC        = 60 / SONG_BPM;

const PLAYER_SIZE     = 38;
const GRAVITY_BASE    = 2100;
const JUMP_VEL_BASE   = 820;
const SPEED_BASE      = 320;

// Round 2 multiplicadores
const R2_SPEED_MULT   = 1.45;
const R2_GRAVITY_MULT = 1.2;
const R2_JUMP_MULT    = 1.15;
const R2_OBSTACLE_CHANCE = 0.72; // mais obstáculos

// Paletas
const PALETTE = {
  p1: { player: '#ffe84a', glow: '#ffb800', trail: '#ff8c00' },
  p2: { player: '#48f3ff', glow: '#00c8ff', trail: '#0088ff' },
  sky1Top:    '#10164d',
  sky1Bot:    '#08091a',
  sky2Top:    '#08091a',
  sky2Bot:    '#10164d',
  ground:     '#141630',
  divider:    '#2a2f5e',
  grid:       '#2ff3ff',
  obstacle:   '#ff3d7f',
  obstacleR2: '#ff6a00',
  powerShield:'#a78bfa',
  powerSlow:  '#34d399',
  powerFlip:  '#fb923c',
  powerStar:  '#facc15',
};

// ──────────────────────────────────────────────
//  Estado global
// ──────────────────────────────────────────────
const state = {
  mode: 'bot',           // 'bot' | 'local'
  running: false,
  paused: false,
  round: 1,
  time: 0,
  lastTime: 0,
  songTime: 0,
  width: 0,
  height: 0,
  dpr: 1,
  laneHeight: 0,
  // posições das faixas
  lane1Y: { top: 0, ground: 0 },
  lane2Y: { top: 0, ground: 0 },
  progress: 0,           // 0..1 progresso da música
  generatedBeats: new Set(),
  obstacles: [],         // { lane, x, y, w, h, beat }
  powerups: [],          // { lane, x, y, type, size }
  particles: [],
  beatFlash: 0,          // 0..1 decai rápido
  players: [null, null],
};

// Player template
function makePlayer(lane) {
  const groundY = lane === 0 ? state.lane1Y.ground : state.lane2Y.ground;
  return {
    lane,
    x: 110,
    y: groundY - PLAYER_SIZE,
    size: PLAYER_SIZE,
    vy: 0,
    grounded: true,
    rotation: 0,
    dead: false,
    deathTime: -1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    // power-up state
    shield: 0,       // segundos restantes
    slow: 0,
    flipGravity: 0,
    invincible: 0,
    starPower: 0,
  };
}

// ──────────────────────────────────────────────
//  Audio & Beat Detection
// ──────────────────────────────────────────────
let audioCtx = null;
let audioBuffer = null;
let audioSource = null;
let analyser = null;
let freqData = null;
let audioStartedAt = 0;
let audioOffset = 0;
let audioLoaded = false;

async function loadAudio() {
  try {
    const resp = await fetch(SONG_SRC);
    const arrBuf = await resp.arrayBuffer();
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = await audioCtx.decodeAudioData(arrBuf);
    audioLoaded = true;
  } catch(e) {
    console.warn('Áudio não carregado, rodando sem música:', e);
  }
}

function startAudio(offsetSeconds = 0) {
  if (!audioLoaded || !audioCtx) return;
  if (audioSource) { try { audioSource.stop(); } catch(_){} }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  freqData = new Uint8Array(analyser.frequencyBinCount);

  audioSource = audioCtx.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(analyser);
  analyser.connect(audioCtx.destination);
  audioSource.start(0, offsetSeconds);
  audioStartedAt = audioCtx.currentTime - offsetSeconds;
  audioOffset = offsetSeconds;
}

function stopAudio() {
  if (audioSource) { try { audioSource.stop(); } catch(_){} audioSource = null; }
}

function getCurrentSongTime() {
  if (!audioCtx || !audioLoaded) return state.time;
  return audioCtx.currentTime - audioStartedAt;
}

function getBassEnergy() {
  if (!analyser || !freqData) return 0;
  analyser.getByteFrequencyData(freqData);
  // Frequências de baixo: bins 1-6 (~40-250 Hz com fftSize 512 / 44100hz)
  let sum = 0;
  for (let i = 1; i <= 6; i++) sum += freqData[i];
  return sum / (6 * 255);
}

// ──────────────────────────────────────────────
//  Resize
// ──────────────────────────────────────────────
function resize() {
  state.dpr    = Math.min(window.devicePixelRatio || 1, 2);
  state.width  = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width  = Math.floor(state.width  * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const HUD_H = 56;
  const usable = state.height - HUD_H;
  state.laneHeight = Math.floor(usable / 2);

  // Lane 1 = topo (player 1)
  state.lane1Y.top    = HUD_H;
  state.lane1Y.ground = HUD_H + state.laneHeight;

  // Lane 2 = baixo (player 2) — gravidade invertida!
  state.lane2Y.top    = HUD_H + state.laneHeight;
  state.lane2Y.ground = HUD_H + state.laneHeight + 4; // chão da lane 2 é o teto (ela pula para baixo)

  // Recalcula posição dos players se vivos
  if (state.players[0] && !state.players[0].dead) {
    state.players[0].y = state.lane1Y.ground - PLAYER_SIZE;
  }
  if (state.players[1] && !state.players[1].dead) {
    // Player 2 tem gravidade invertida: "chão" é o topo da faixa 2
    state.players[1].y = state.lane2Y.top + 4;
  }
}

// ──────────────────────────────────────────────
//  RNG determinístico
// ──────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    let v = (seed += 0x6d2b79f5);
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(7319);

// ──────────────────────────────────────────────
//  Geração de obstáculos baseada nas batidas
// ──────────────────────────────────────────────
function generateObstaclesForBeat(beat) {
  const r = mulberry32(beat * 1013 + state.round * 999);
  const chance = state.round === 1 ? 0.52 : R2_OBSTACLE_CHANCE;
  if (beat < 4) return;

  const speed = getSpeed();

  // Lane 1
  if (r() < chance) {
    const spikeW = 28 + Math.floor(r() * 24);
    const spikeH = 30 + Math.floor(r() * 22);
    // Round 2: às vezes gera obstáculo duplo
    if (state.round === 2 && r() < 0.3) {
      // Dois spikes juntos
      const gap = 14 + Math.floor(r() * 20);
      state.obstacles.push(makeObstacle(0, spikeW, spikeH, beat, 0));
      state.obstacles.push(makeObstacleOffset(0, spikeW, spikeH, beat, spikeW + gap));
    } else {
      state.obstacles.push(makeObstacle(0, spikeW, spikeH, beat, 0));
    }
  }
  // Lane 2 – pode ser sincronizada ou deslocada
  const r2 = mulberry32(beat * 2017 + state.round * 333);
  if (r2() < chance) {
    const spikeW = 28 + Math.floor(r2() * 24);
    const spikeH = 30 + Math.floor(r2() * 22);
    if (state.round === 2 && r2() < 0.3) {
      const gap = 14 + Math.floor(r2() * 20);
      state.obstacles.push(makeObstacle(1, spikeW, spikeH, beat, 0));
      state.obstacles.push(makeObstacleOffset(1, spikeW, spikeH, beat, spikeW + gap));
    } else {
      state.obstacles.push(makeObstacle(1, spikeW, spikeH, beat, 0));
    }
  }

  // Power-up a cada 8 batidas
  if (beat % 8 === 0 && beat > 8) {
    const pu_r = mulberry32(beat * 555);
    const types = ['shield', 'slow', 'star'];
    if (state.round === 2) types.push('flip');
    const type = types[Math.floor(pu_r() * types.length)];
    const lane = Math.floor(pu_r() * 2);
    state.powerups.push(makePowerup(lane, type, beat));
  }
}

function makeObstacle(lane, w, h, beat, extraOffset = 0) {
  const speed = getSpeed();
  const beatSec = state.round === 1 ? BEAT_SEC : BEAT_SEC / R2_SPEED_MULT;
  const futureX = state.width + (state.time + 1.8 + beat * 0.01) * speed - state.time * speed;
  const baseX = state.width + 60 + extraOffset;

  if (lane === 0) {
    return { lane: 0, x: baseX, y: state.lane1Y.ground - h, w, h, beat, hit: false };
  } else {
    // Lane 2: spikes apontam para baixo (desde o topo da faixa)
    return { lane: 1, x: baseX, y: state.lane2Y.top + 4, w, h, beat, hit: false };
  }
}

function makeObstacleOffset(lane, w, h, beat, offset) {
  const obs = makeObstacle(lane, w, h, beat, offset);
  obs.x += offset;
  return obs;
}

function makePowerup(lane, type, beat) {
  const groundY = lane === 0
    ? state.lane1Y.ground - PLAYER_SIZE - 20
    : state.lane2Y.top + PLAYER_SIZE + 12;
  return {
    lane, type,
    x: state.width + 80,
    y: groundY,
    size: 22,
    beat,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

function generateUpcoming() {
  const songTime = getCurrentSongTime();
  const beatNow = Math.floor(songTime / BEAT_SEC);
  for (let b = Math.max(0, beatNow - 1); b <= beatNow + 8; b++) {
    if (state.generatedBeats.has(b)) continue;
    state.generatedBeats.add(b);
    generateObstaclesForBeat(b);
  }
}

// ──────────────────────────────────────────────
//  Helpers de velocidade / física
// ──────────────────────────────────────────────
function getSpeed()   { return state.round === 1 ? SPEED_BASE   : SPEED_BASE * R2_SPEED_MULT; }
function getGravity() { return state.round === 1 ? GRAVITY_BASE : GRAVITY_BASE * R2_GRAVITY_MULT; }
function getJumpVel() { return state.round === 1 ? JUMP_VEL_BASE: JUMP_VEL_BASE * R2_JUMP_MULT; }

// ──────────────────────────────────────────────
//  Partículas
// ──────────────────────────────────────────────
function spawnParticles(x, y, color, count = 10, isExplosion = false) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const spd   = isExplosion ? (80 + Math.random() * 200) : (40 + Math.random() * 120);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: isExplosion ? 1.8 + Math.random() : 2.5 + Math.random(),
      size: isExplosion ? 3 + Math.random() * 5 : 2 + Math.random() * 3,
      color,
    });
  }
}

// ──────────────────────────────────────────────
//  Pulo
// ──────────────────────────────────────────────
function jump(playerIdx) {
  if (!state.running) return;
  const p = state.players[playerIdx];
  if (!p || p.dead) return;

  if (playerIdx === 0) {
    // Lane 1: pula para cima
    if (p.grounded) {
      p.vy = -getJumpVel();
      p.grounded = false;
      spawnParticles(p.x + p.size / 2, p.y + p.size, PALETTE.p1.trail, 6);
    }
  } else {
    // Lane 2: gravidade invertida – pula para baixo (vy positivo)
    if (p.grounded) {
      p.vy = getJumpVel();
      p.grounded = false;
      spawnParticles(p.x + p.size / 2, p.y, PALETTE.p2.trail, 6);
    }
  }
}

// ──────────────────────────────────────────────
//  Update
// ──────────────────────────────────────────────
function update(dt) {
  const slowActive = state.players.some(p => p && !p.dead && p.slow > 0);
  const effectiveDt = slowActive ? dt * 0.5 : dt;

  state.time    += dt;
  state.songTime = getCurrentSongTime();
  state.progress = Math.min(1, state.songTime / SONG_DURATION);
  state.beatFlash = Math.max(0, state.beatFlash - dt * 4);

  // Beat flash por análise de baixo
  const bass = getBassEnergy();
  if (bass > 0.55) state.beatFlash = Math.min(1, state.beatFlash + bass * 0.4);

  // Verificar transição de round
  if (state.round === 1 && state.songTime >= SONG_DURATION) {
    startRound2();
    return;
  }
  if (state.round === 2 && state.songTime >= SONG_DURATION * 2) {
    endGame('timeout');
    return;
  }

  generateUpcoming();

  const speed = getSpeed();
  const gravity = getGravity();

  // ─── Player 1 (lane topo, gravidade normal) ───
  const p1 = state.players[0];
  if (p1 && !p1.dead) {
    updatePlayerTimers(p1, dt);
    const g = p1.flipGravity > 0 ? -gravity : gravity;
    p1.vy += g * effectiveDt;
    p1.y  += p1.vy * effectiveDt;
    p1.rotation += (p1.grounded ? 0 : 7) * effectiveDt;

    const floorY = p1.flipGravity > 0 ? state.lane1Y.top + 4 : state.lane1Y.ground - PLAYER_SIZE;
    const ceilY  = p1.flipGravity > 0 ? state.lane1Y.ground - PLAYER_SIZE : state.lane1Y.top + 4;

    if (p1.flipGravity > 0) {
      if (p1.y <= ceilY) { p1.y = ceilY; p1.vy = 0; p1.grounded = true; p1.rotation = 0; }
    } else {
      if (p1.y + p1.size >= state.lane1Y.ground) {
        p1.y = state.lane1Y.ground - p1.size; p1.vy = 0; p1.grounded = true; p1.rotation = 0;
      }
    }
    // Teto
    if (p1.y < state.lane1Y.top) { p1.y = state.lane1Y.top + 2; p1.vy = Math.abs(p1.vy) * 0.3; }

    // Pontos por sobrevivência
    p1.score += dt * 10 * (1 + p1.combo * 0.1) * (state.round === 2 ? 2 : 1);
    p1.comboTimer -= dt;
    if (p1.comboTimer <= 0 && p1.combo > 0) { p1.combo = 0; }
  }

  // ─── Player 2 (lane baixo, gravidade invertida) ───
  const p2 = state.players[1];
  if (p2 && !p2.dead) {
    updatePlayerTimers(p2, dt);
    // Gravidade invertida: cai para CIMA (vy negativo é "cair")
    const g = p2.flipGravity > 0 ? gravity : -gravity;
    p2.vy += g * effectiveDt;
    p2.y  += p2.vy * effectiveDt;
    p2.rotation -= (p2.grounded ? 0 : 7) * effectiveDt;

    const laneBottom = state.height - 4;
    const laneTop    = state.lane2Y.top + 4;

    // "Chão" do P2 é o TOPO da faixa 2 (ele fica grudado lá em cima)
    if (p2.flipGravity > 0) {
      // Quando com flip, o "chão" é o fundo
      if (p2.y + p2.size >= laneBottom) {
        p2.y = laneBottom - p2.size; p2.vy = 0; p2.grounded = true; p2.rotation = 0;
      }
    } else {
      if (p2.y <= laneTop) {
        p2.y = laneTop; p2.vy = 0; p2.grounded = true; p2.rotation = 0;
      }
    }
    // Fundo
    if (p2.y + p2.size > laneBottom) { p2.y = laneBottom - p2.size; p2.vy = Math.min(0, p2.vy); }

    p2.score += dt * 10 * (1 + p2.combo * 0.1) * (state.round === 2 ? 2 : 1);
    p2.comboTimer -= dt;
    if (p2.comboTimer <= 0 && p2.combo > 0) { p2.combo = 0; }
  }

  // ─── Bot AI ───
  if (state.mode === 'bot' && p2 && !p2.dead) {
    botThink(p2, effectiveDt);
  }

  // ─── Mover obstáculos ───
  const slowMult = slowActive ? 0.5 : 1;
  for (const obs of state.obstacles) obs.x -= speed * slowMult * dt;
  state.obstacles = state.obstacles.filter(o => o.x + o.w > -100);

  // ─── Mover power-ups ───
  for (const pu of state.powerups) pu.x -= speed * slowMult * dt;
  state.powerups = state.powerups.filter(pu => pu.x + pu.size > -100 && !pu.collected);

  // ─── Colisão obstáculo ───
  for (const obs of state.obstacles) {
    if (obs.hit) continue;
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      if (!p || p.dead || p.invincible > 0) continue;
      if (obs.lane !== p.lane) continue;
      if (rectsIntersect(p, obs)) {
        if (p.shield > 0) {
          p.shield = 0;
          obs.hit = true;
          spawnParticles(p.x + p.size/2, p.y + p.size/2, PALETTE.powerShield, 12, true);
          showToast('🛡️ Escudo quebrado!', PALETTE.powerShield);
        } else {
          killPlayer(i);
          obs.hit = true;
        }
      }
    }
  }

  // ─── Colisão power-up ───
  for (const pu of state.powerups) {
    if (pu.collected) continue;
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      if (!p || p.dead) continue;
      if (pu.lane !== p.lane) continue;
      if (circleRectIntersect(pu, p)) {
        collectPowerup(i, pu);
        pu.collected = true;
      }
    }
  }

  // ─── Partículas ───
  for (const par of state.particles) {
    par.x    += par.vx * dt;
    par.y    += par.vy * dt;
    par.vy   += 120 * dt;
    par.life -= par.decay * dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  // Trilha contínua dos players vivos
  if (Math.random() < 0.35) {
    if (p1 && !p1.dead) spawnParticles(p1.x, p1.y + p1.size/2, PALETTE.p1.trail, 1);
    if (p2 && !p2.dead) spawnParticles(p2.x, p2.y + p2.size/2, PALETTE.p2.trail, 1);
  }

  // HUD
  updateHUD();

  // Checar fim de jogo (ambos mortos)
  if (state.players[0]?.dead && state.players[1]?.dead) {
    endGame('both_dead');
  }
}

function updatePlayerTimers(p, dt) {
  if (p.shield    > 0) p.shield    -= dt;
  if (p.slow      > 0) p.slow      -= dt;
  if (p.flipGravity>0) p.flipGravity-= dt;
  if (p.invincible> 0) p.invincible -= dt;
  if (p.starPower > 0) p.starPower -= dt;
}

// ──────────────────────────────────────────────
//  Bot simples mas com dificuldade crescente
// ──────────────────────────────────────────────
let botJumpCooldown = 0;
function botThink(p2, dt) {
  botJumpCooldown -= dt;

  // Encontrar obstáculo mais próximo na lane 2
  const upcoming = state.obstacles
    .filter(o => o.lane === 1 && o.x > p2.x && o.x < p2.x + 340)
    .sort((a, b) => a.x - b.x)[0];

  if (!upcoming || botJumpCooldown > 0) return;

  const dist = upcoming.x - p2.x;
  const reactionDist = state.round === 1 ? 180 : 140;

  if (dist < reactionDist && p2.grounded) {
    // Bot pode errar no round 1 (10% de chance de falhar)
    if (state.round === 1 && Math.random() < 0.10) return;
    jump(1);
    botJumpCooldown = BEAT_SEC * 0.4;
  }
}

// ──────────────────────────────────────────────
//  Power-ups
// ──────────────────────────────────────────────
function collectPowerup(playerIdx, pu) {
  const p = state.players[playerIdx];
  if (!p) return;
  spawnParticles(pu.x, pu.y, getPowerupColor(pu.type), 14, true);

  switch (pu.type) {
    case 'shield':
      p.shield = 8;
      showToast('🛡️ Escudo!', PALETTE.powerShield);
      break;
    case 'slow':
      p.slow = 5;
      showToast('⏱️ Slow!', PALETTE.powerSlow);
      break;
    case 'flip':
      p.flipGravity = 5;
      showToast('🔄 Gravidade Invertida!', PALETTE.powerFlip);
      break;
    case 'star':
      p.invincible = 4;
      p.starPower = 4;
      showToast('⭐ Invencível!', PALETTE.powerStar);
      break;
  }

  p.combo += 1;
  p.comboTimer = 5;
}

function getPowerupColor(type) {
  const map = {
    shield: PALETTE.powerShield,
    slow:   PALETTE.powerSlow,
    flip:   PALETTE.powerFlip,
    star:   PALETTE.powerStar,
  };
  return map[type] || '#fff';
}

function showToast(msg, color) {
  powerupToast.textContent = msg;
  powerupToast.style.color = color || '#fff';
  powerupToast.classList.remove('show');
  void powerupToast.offsetWidth;
  powerupToast.classList.add('show');
  setTimeout(() => powerupToast.classList.remove('show'), 1900);
}

// ──────────────────────────────────────────────
//  Colisão helpers
// ──────────────────────────────────────────────
function rectsIntersect(p, obs) {
  const pad = 7;
  return (
    p.x + pad < obs.x + obs.w &&
    p.x + p.size - pad > obs.x &&
    p.y + pad < obs.y + obs.h &&
    p.y + p.size - pad > obs.y
  );
}

function circleRectIntersect(circle, rect) {
  const cx = circle.x + circle.size / 2;
  const cy = circle.y + circle.size / 2;
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.size));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.size));
  const dx = cx - closestX, dy = cy - closestY;
  return dx * dx + dy * dy < (circle.size + 8) ** 2;
}

// ──────────────────────────────────────────────
//  Matar player
// ──────────────────────────────────────────────
function killPlayer(idx) {
  const p = state.players[idx];
  if (!p || p.dead) return;
  p.dead = true;
  p.deathTime = state.time;
  const color = idx === 0 ? PALETTE.p1.glow : PALETTE.p2.glow;
  spawnParticles(p.x + p.size/2, p.y + p.size/2, color, 20, true);
}

// ──────────────────────────────────────────────
//  Round 2
// ──────────────────────────────────────────────
function startRound2() {
  state.round = 2;
  state.generatedBeats.clear();
  state.obstacles = [];
  state.powerups  = [];

  // Ressuscita players mortos com 50% do score
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (p && p.dead) {
      p.dead = false;
      p.vy = 0;
      p.grounded = true;
      p.rotation = 0;
      p.shield = 0; p.slow = 0; p.flipGravity = 0; p.invincible = 0;
      if (i === 0) p.y = state.lane1Y.ground - PLAYER_SIZE;
      else         p.y = state.lane2Y.top + 4;
    }
  }

  roundBadge.textContent = 'ROUND 2 – DIFÍCIL!';
  roundBadge.classList.add('round2');

  // Toca a música de novo
  startAudio(0);
  showToast('🔥 ROUND 2 – DIFÍCIL!', '#ff4b67');
}

// ──────────────────────────────────────────────
//  Fim de jogo
// ──────────────────────────────────────────────
function endGame(reason) {
  state.running = false;
  stopAudio();

  const p1 = state.players[0];
  const p2 = state.players[1];
  const s1 = Math.floor(p1?.score || 0);
  const s2 = Math.floor(p2?.score || 0);

  finalScore1.textContent = s1;
  finalScore2.textContent = s2;

  let winnerText = '';
  if (s1 > s2) {
    winnerText = '🏆 P1 VENCEU!';
    resultWinner.style.color = PALETTE.p1.glow;
  } else if (s2 > s1) {
    winnerText = '🏆 P2 VENCEU!';
    resultWinner.style.color = PALETTE.p2.glow;
  } else {
    winnerText = '🤝 EMPATE!';
    resultWinner.style.color = '#fff';
  }

  resultWinner.textContent = winnerText;
  resultPanel.classList.remove('hidden');
}

// ──────────────────────────────────────────────
//  HUD update
// ──────────────────────────────────────────────
function updateHUD() {
  const p1 = state.players[0];
  const p2 = state.players[1];

  score1El.textContent = Math.floor(p1?.score || 0);
  score2El.textContent = Math.floor(p2?.score || 0);

  if (p1?.combo >= 3) combo1El.textContent = `×${p1.combo} COMBO`;
  else combo1El.textContent = '';
  if (p2?.combo >= 3) combo2El.textContent = `×${p2.combo} COMBO`;
  else combo2El.textContent = '';

  const pct = Math.round(state.progress * 100);
  progressPct.textContent = `${pct}%`;
  progressBar1.style.width = `${pct}%`;
  progressBar2.style.width = `${pct}%`;
  progressShip1.style.left = `${pct}%`;
  progressShip2.style.left = `${pct}%`;
}

// ──────────────────────────────────────────────
//  Draw
// ──────────────────────────────────────────────
function draw() {
  const W = state.width, H = state.height;

  // ─── Fundo lane 1 (topo) ───
  const sky1 = ctx.createLinearGradient(0, state.lane1Y.top, 0, state.lane1Y.ground);
  sky1.addColorStop(0, '#10164d');
  sky1.addColorStop(1, '#08091a');
  ctx.fillStyle = sky1;
  ctx.fillRect(0, state.lane1Y.top, W, state.laneHeight);

  // ─── Fundo lane 2 (baixo) ───
  const sky2 = ctx.createLinearGradient(0, state.lane2Y.top, 0, H);
  sky2.addColorStop(0, '#08091a');
  sky2.addColorStop(1, '#10164d');
  ctx.fillStyle = sky2;
  ctx.fillRect(0, state.lane2Y.top, W, H - state.lane2Y.top);

  // ─── Beat flash ───
  if (state.beatFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.beatFlash * 0.06;
    ctx.fillStyle = '#48f3ff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ─── Grid lane 1 ───
  drawGrid(state.lane1Y.top, state.lane1Y.ground, false);
  // ─── Grid lane 2 ───
  drawGrid(state.lane2Y.top, H, true);

  // ─── Chão lane 1 ───
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, state.lane1Y.ground, W, 4);

  // ─── "Chão" lane 2 (topo da faixa) ───
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, state.lane2Y.top, W, 4);

  // ─── Divisória central ───
  ctx.save();
  ctx.strokeStyle = PALETTE.divider;
  ctx.lineWidth = 2;
  const divY = state.lane1Y.ground + 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, divY);
  ctx.lineTo(W, divY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ─── Obstáculos ───
  for (const obs of state.obstacles) drawObstacle(obs);

  // ─── Power-ups ───
  for (const pu of state.powerups) drawPowerup(pu);

  // ─── Partículas ───
  for (const par of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, par.life);
    ctx.fillStyle = par.color;
    ctx.shadowColor = par.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(par.x, par.y, par.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── Players ───
  drawPlayer(state.players[0], PALETTE.p1, 0);
  drawPlayer(state.players[1], PALETTE.p2, 1);

  // ─── Indicadores de morte ───
  drawDeadIndicator(state.players[0], 0);
  drawDeadIndicator(state.players[1], 1);
}

function drawGrid(yTop, yBottom, flip) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  const offset = -(state.songTime * getSpeed() * 0.035) % 52;
  for (let x = offset; x < state.width; x += 52) {
    ctx.beginPath();
    if (flip) {
      ctx.moveTo(x, yTop);
      ctx.lineTo(x - 80, yBottom);
    } else {
      ctx.moveTo(x, yBottom);
      ctx.lineTo(x + 80, yTop);
    }
    ctx.stroke();
  }
  const rowH = 32;
  for (let y = yTop; y < yBottom; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacle(obs) {
  const color = state.round === 2 ? PALETTE.obstacleR2 : PALETTE.obstacle;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  if (obs.lane === 0) {
    // Spike apontando para cima (lane 1)
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y + obs.h);
    ctx.lineTo(obs.x + obs.w / 2, obs.y);
    ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
    ctx.closePath();
    ctx.fill();
  } else {
    // Spike apontando para baixo (lane 2)
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y);
    ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
    ctx.lineTo(obs.x + obs.w, obs.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPowerup(pu) {
  const color = getPowerupColor(pu.type);
  const bob = Math.sin(state.time * 3 + pu.bobPhase) * 5;
  const icons = { shield: '🛡', slow: '⏱', flip: '🔄', star: '⭐' };
  const icon = icons[pu.type] || '?';
  const s = pu.size;

  ctx.save();
  ctx.translate(pu.x + s / 2, pu.y + s / 2 + bob);

  // Glow circle
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
  grad.addColorStop(0, color + 'cc');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();

  // Rotate slowly
  ctx.rotate(state.time * 1.2);
  ctx.font = `${s}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 0, 1);

  ctx.restore();
}

function drawPlayer(p, palette, idx) {
  if (!p) return;
  if (p.dead) return;

  const isInvincible = p.invincible > 0;
  const hasShield   = p.shield > 0;

  ctx.save();
  ctx.translate(p.x + p.size / 2, p.y + p.size / 2);
  ctx.rotate(p.rotation);

  // Escudo aura
  if (hasShield) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(state.time * 6);
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.powerShield;
    ctx.lineWidth = 3;
    ctx.shadowColor = PALETTE.powerShield;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }

  // Star power rainbow
  if (isInvincible) {
    const hue = (state.time * 300) % 360;
    ctx.shadowColor = `hsl(${hue},100%,60%)`;
    ctx.shadowBlur = 30;
    ctx.fillStyle = `hsl(${hue},100%,70%)`;
  } else {
    ctx.fillStyle = palette.player;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 22;
  }

  const half = p.size / 2;
  ctx.fillRect(-half, -half, p.size, p.size);

  // Inner square decoration
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  const inner = half * 0.55;
  ctx.fillRect(-inner, -inner, inner * 2, inner * 2);

  ctx.restore();
}

function drawDeadIndicator(p, idx) {
  if (!p || !p.dead) return;
  const palette = idx === 0 ? PALETTE.p1 : PALETTE.p2;
  const laneCenter = idx === 0
    ? (state.lane1Y.top + state.lane1Y.ground) / 2
    : (state.lane2Y.top + state.height) / 2;
  const elapsed = state.time - p.deathTime;
  const alpha = Math.max(0, 1 - elapsed * 0.4);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = palette.glow;
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = idx === 0 ? 'P1' : 'P2';
  ctx.fillText(`💀 ${name}`, state.width / 2, laneCenter);
  ctx.restore();
}

// ──────────────────────────────────────────────
//  Game loop
// ──────────────────────────────────────────────
function loop(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.04);
  state.lastTime = now;
  if (state.running) update(dt);
  draw();
  if (state.running) requestAnimationFrame(loop);
}

// ──────────────────────────────────────────────
//  Init / Start / Reset
// ──────────────────────────────────────────────
function initGame() {
  state.running        = false;
  state.round          = 1;
  state.time           = 0;
  state.songTime       = 0;
  state.lastTime       = 0;
  state.progress       = 0;
  state.beatFlash      = 0;
  state.obstacles      = [];
  state.powerups       = [];
  state.particles      = [];
  state.generatedBeats.clear();
  botJumpCooldown      = 0;

  resize();

  state.players[0] = makePlayer(0);
  state.players[1] = makePlayer(1);

  // P2 começa no topo da faixa 2 (gravidade invertida: grounded = encostado no topo)
  state.players[1].y = state.lane2Y.top + 4;

  roundBadge.textContent = 'ROUND 1';
  roundBadge.classList.remove('round2');
}

function startGame() {
  initGame();
  state.running  = true;
  state.lastTime = performance.now();
  panel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  startAudio(0);
  requestAnimationFrame(loop);
}

// ──────────────────────────────────────────────
//  Eventos
// ──────────────────────────────────────────────
window.addEventListener('resize', resize);

// Teclado
window.addEventListener('keydown', e => {
  if (e.code === 'Space')  { e.preventDefault(); jump(0); }
  if (e.code === 'Enter')  { e.preventDefault(); jump(1); }
  if (e.code === 'ArrowUp'){ e.preventDefault(); jump(0); }
  if (e.code === 'ArrowDown'){ e.preventDefault(); jump(1); }
});

// Toque – metade esq = P1, metade dir = P2
window.addEventListener('pointerdown', e => {
  if (e.target instanceof HTMLButtonElement) return;
  if (!state.running) return;
  if (e.clientX < state.width / 2) jump(0);
  else jump(1);
}, { passive: true });

// Mode selector
modeVsBot.addEventListener('click', () => {
  state.mode = 'bot';
  modeVsBot.classList.add('active');
  modeLocal.classList.remove('active');
});
modeLocal.addEventListener('click', () => {
  state.mode = 'local';
  modeLocal.classList.add('active');
  modeVsBot.classList.remove('active');
});

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', () => {
  resultPanel.classList.add('hidden');
  startGame();
});

// ──────────────────────────────────────────────
//  Boot
// ──────────────────────────────────────────────
resize();
draw(); // frame inicial estático
loadAudio(); // carrega a música em background
