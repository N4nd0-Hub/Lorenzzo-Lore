"use strict";

/* Motor do prólogo jogável: entrada, física, ataques, partículas e laço principal.
   O cenário, o treino e os diálogos ficam em floresta.js; o chicote em chicote.js. */

const el = id => document.getElementById(id);
const canvas = el("game"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const FULL_AMMO = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const range = (a, b, d) => Math.abs(a - b) <= d;
const held = new Set(), pressed = new Set();
const valid = new Set(["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "Space", "KeyW", "ArrowUp", "KeyJ", "KeyK", "KeyE", "Escape"]);

let mode = "title", player, bullets = [], particles = [];
let camera = 0, elapsed = 0, toastUntil = 0, shake = 0;
let audioContext, sound = false;

function spawn() {
  player = {x:162, y:forestGround, vx:0, vy:0, face:1, ground:true, coyote:0, buffer:0,
    ammo:FULL_AMMO, action:null, actionTime:0, actionHit:false, walk:0, landing:0};
  bullets = []; particles = []; shake = 0;
  camera = clamp(player.x - W * .42, 0, forestWidth - W);
  toastUntil = 0;
  el("toast").hidden = true;
  updateUI();
}

function setMode(next) {
  mode = next;
  held.clear(); pressed.clear();
  el("pause").disabled = !["playing", "paused"].includes(mode);
  el("pause").textContent = mode === "paused" ? "Continuar" : "Pausar";
  el("overlay").hidden = mode === "playing";
  el("reset").hidden = mode !== "paused";
  el("back-link").hidden = mode === "paused";
  if (mode === "playing") {
    canvas.focus({preventScroll:true});
    return;
  }
  el("prompt").hidden = true;
  const views = {
    title:["Prólogo · West Blue", "O treino na floresta", "Anos depois do incêndio, Lorenzzo vive sob os cuidados da Ordem da Santa Vigília. Hoje, Padre Quinn vai ensiná-lo a lutar.", "Começar"],
    paused:["Pausa", "Treino pausado", "Retome quando quiser.", "Continuar"],
    won:["Fim do prólogo", "Treino concluído", "“Quem aprende a usar força precisa aprender a hora de baixar a mão também.”", "Treinar de novo"]
  };
  const [kicker, title, message, button] = views[mode];
  el("overlay-kicker").textContent = kicker;
  el("overlay-title").textContent = title;
  el("overlay-text").textContent = message;
  el("primary").firstChild.textContent = button + " ";
  el("overlay").dataset.mode = mode;
  el("primary").focus({preventScroll:true});
}

function say(message, seconds=2.8) {
  el("toast").textContent = message;
  el("toast").hidden = false;
  toastUntil = elapsed + seconds;
}

function updateUI() {
  const holder = el("ammo");
  const value = player.ammo + " de " + FULL_AMMO + " cartuchos";
  if (holder.getAttribute("aria-label") === value && holder.childElementCount) return;
  holder.setAttribute("aria-label", value);
  holder.replaceChildren(...Array.from({length:FULL_AMMO}, (_,i) => {
    const mark = document.createElement("i");
    mark.className = i < player.ammo ? "" : "empty";
    return mark;
  }));
}

function sfx(freq, seconds=.15, tail=.62, shape="triangle", volume=.052) {
  if (!sound || !audioContext) return;
  const start = audioContext.currentTime, tone = audioContext.createOscillator(), gain = audioContext.createGain();
  tone.type = shape;
  tone.frequency.setValueAtTime(freq, start);
  tone.frequency.exponentialRampToValueAtTime(freq * tail, start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + seconds);
  tone.connect(gain).connect(audioContext.destination);
  tone.start(start); tone.stop(start + seconds);
}
function noise(seconds, freq, volume=.08) {
  if (!sound || !audioContext) return;
  const t = audioContext.currentTime, n = Math.floor(audioContext.sampleRate * seconds);
  const buffer = audioContext.createBuffer(1, n, audioContext.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
  source.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = freq; filter.Q.value = .8;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(audioContext.destination); source.start(t);
}

function burst(x,y,color,count=9,spread=155,lift=135) {
  for (let i=0; i<count; i++) {
    particles.push({x,y,vx:(Math.random()-.5)*spread,vy:-25-Math.random()*lift,t:.21+Math.random()*.28,color});
  }
}

function attack(type) {
  if (!forestCanAttack(type)) return;
  if (type === "shoot" && !player.ammo) {
    say("Use E junto à caixa para repor os cartuchos.");
    sfx(118,.09);
    return;
  }
  player.action = type;
  player.actionTime = 0;
  player.actionHit = false;
  if (type === "whip") resetWhip(player);
}

function updateAttack(dt) {
  if (!player.action) return;
  player.actionTime += dt;
  const whip = player.action === "whip";
  const time = player.actionTime;
  if (!player.actionHit && time >= (whip ? WHIP_STRIKE : .12)) {
    player.actionHit = true;
    if (whip) {
      sfx(240,.13,.36,"sawtooth",.04);
      noise(.09, 3200, .12);
      forestWhip();
    } else {
      player.ammo--;
      const x = player.x + 58 * player.face, y = player.y - 42;
      bullets.push({x,y,from:player.x + 8*player.face,vx:player.face*790,t:.58});
      burst(x,y,"#ffcf81",6);
      sfx(105,.16,.42,"square");
      noise(.18, 900, .16);
      shake = .11;
    }
  }
  if (time >= (whip ? WHIP_DURATION : .33)) player.action = null;
}

function update(dt) {
  const p = player;
  elapsed += dt;
  if (elapsed >= toastUntil && !el("toast").hidden) el("toast").hidden = true;
  p.landing = Math.max(0,p.landing-dt);
  shake = Math.max(0,shake-dt);
  if (p.ground) p.coyote = .095;
  else p.coyote -= dt;
  if (pressed.has("Space") || pressed.has("KeyW") || pressed.has("ArrowUp")) p.buffer = .12;
  else p.buffer -= dt;
  const direction = Number(held.has("KeyD") || held.has("ArrowRight")) - Number(held.has("KeyA") || held.has("ArrowLeft"));
  if (direction && !p.action) p.face = direction;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -540; p.ground = false; p.coyote = 0; p.buffer = 0; p.landing = 0;
    burst(p.x,p.y,"#8f8a63",5,90,60);
    sfx(194,.12,1.4,"triangle",.035);
  }
  if (!p.action) {
    if (pressed.has("KeyJ")) attack("whip");
    else if (pressed.has("KeyK")) attack("shoot");
  }
  updateAttack(dt);
  const speed = direction * (p.action && p.ground ? 92 : 254);
  p.vx += (speed-p.vx)*Math.min(1,dt*(direction ? 22 : 29));
  p.vy = Math.min(710,p.vy+1280*dt);
  const lastY = p.y;
  p.x = clamp(p.x+p.vx*dt,15,forestWidth-19);
  p.y += p.vy*dt;
  p.ground = false;
  if (p.vy >= 0) {
    const land = forestPlatforms.filter(s => p.x+8 > s.x && p.x-8 < s.x+s.w && lastY <= s.y && p.y >= s.y)
      .sort((a,b) => a.y-b.y)[0];
    if (land) {
      if (p.vy > 130) {
        p.landing = .16;
        burst(p.x,land.y,"#7d7a55",6,110,50);
        noise(.07, 600, .05);
      }
      p.y = land.y; p.vy = 0; p.ground = true;
    }
  }
  if (p.y > forestGround + 60) forestFall();
  if (mode !== "playing") return;
  if (p.action === "whip") updateWhip(p,dt);
  p.walk += Math.abs(p.vx)*dt;
  for (const bullet of bullets) {
    const previousX = bullet.from ?? bullet.x;
    bullet.from = null;
    bullet.x += bullet.vx*dt; bullet.t -= dt;
    forestBullet(bullet,previousX);
  }
  bullets = bullets.filter(b => b.t > 0);
  for (const particle of particles) {
    particle.x += particle.vx*dt; particle.y += particle.vy*dt; particle.vy += 240*dt; particle.t -= dt;
  }
  particles = particles.filter(particle => particle.t > 0);
  forestTick(dt);
  camera += (clamp(p.x-W*.42,0,forestWidth-W)-camera)*Math.min(1,dt*6);
  updateUI();
}

function draw(t) {
  const kick = shake ? Math.sin(t*133)*shake*13 : 0;
  const offset = Math.round(clamp(camera+kick,0,forestWidth-W));
  ctx.save(); ctx.translate(-offset,0);
  drawForest(t,offset);
  for (const b of bullets) {
    ctx.fillStyle="#f0ac66"; ctx.fillRect(b.x-10,b.y,20,2);
    ctx.fillStyle="#ffe6ac"; ctx.fillRect(b.x-4,b.y,8,2);
  }
  drawChild(t);
  drawWhip(player);
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1,p.t*4);
    ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);
  }
  ctx.globalAlpha = 1;
  drawForeground(t,offset);
  ctx.restore();
  drawGrade(t);
}

function press(key) {
  if (!held.has(key)) pressed.add(key);
  held.add(key);
}
window.addEventListener("keydown", e => {
  if (forest?.talk) {
    if (["KeyE","Enter","Space"].includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) advanceTalk();
    } else if (e.code === "Tab") {
      e.preventDefault();
      el("dialogue-next").focus({preventScroll:true});
    }
    return;
  }
  if (!valid.has(e.code)) return;
  if (e.code === "Escape" && ["playing","paused"].includes(mode) && !e.repeat) {
    e.preventDefault(); setMode(mode === "playing" ? "paused" : "playing");
  } else if (mode === "playing" && !(document.activeElement instanceof HTMLButtonElement)) {
    e.preventDefault(); press(e.code);
  }
});
window.addEventListener("keyup", e => held.delete(e.code));
window.addEventListener("blur", () => { if (mode === "playing" && !forest?.talk) setMode("paused"); });
document.querySelectorAll("[data-key]").forEach(button => {
  const key = button.dataset.key;
  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (mode !== "playing" || forest?.talk) return;
    button.setPointerCapture(e.pointerId); press(key);
  });
  for (const event of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(event, () => held.delete(key));
});
function enableSound() {
  if (sound) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audioContext ??= new Audio(); audioContext.resume().catch(()=>{});
  sound = true;
  el("sound").textContent = "Som ligado";
  el("sound").setAttribute("aria-pressed","true");
}
el("primary").addEventListener("click", () => {
  if (mode === "paused") setMode("playing");
  else { if (mode === "title") enableSound(); selectForest(true); }
});
el("pause").addEventListener("click", () => setMode(mode === "playing" ? "paused" : "playing"));
el("reset").addEventListener("click", () => selectForest(true));
el("dialogue-next").addEventListener("click", advanceTalk);
el("sound").addEventListener("click", () => {
  if (sound) {
    sound = false;
    el("sound").textContent = "Som desligado";
    el("sound").setAttribute("aria-pressed","false");
  } else enableSound();
  if (mode === "playing") (forest?.talk ? el("dialogue-next") : canvas).focus({preventScroll:true});
});
el("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el("play").requestFullscreen();
  } catch {
    if (mode === "playing") say("Tela cheia indisponível neste navegador.");
  }
  if (mode === "playing") (forest?.talk ? el("dialogue-next") : canvas).focus({preventScroll:true});
});
canvas.addEventListener("pointerdown", () => canvas.focus({preventScroll:true}));

selectForest(false);
setMode("title");
let then = 0, debt = 0;
function frame(now) {
  const delta = then ? Math.min((now-then)/1000,.055) : 0;
  then = now;
  if (mode === "playing" && !forest?.talk) {
    debt += delta;
    while (debt >= 1/120 && mode === "playing" && !forest?.talk) {
      update(1/120);
      pressed.clear(); debt -= 1/120;
    }
  } else {
    debt = 0;
    if (forest) forestIdle(delta);
  }
  draw(now/1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
