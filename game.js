"use strict";

const el = id => document.getElementById(id);
const canvas = el("game"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, WORLD = 2840;
const FULL_HP = 5, FULL_AMMO = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const range = (a, b, d) => Math.abs(a - b) <= d;
const regions = ["Átrio", "Nave", "Cripta"];
const held = new Set(), pressed = new Set();
const valid = new Set(["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "Space", "KeyW", "ArrowUp", "KeyJ", "KeyK", "KeyE", "ShiftLeft", "ShiftRight", "Escape"]);
const atlas = new Image();
atlas.src = "lorenzzo.png";
const motionAtlas = new Image();
motionAtlas.src = "lorenzzo-movimento.png";
const combatAtlas = new Image();
combatAtlas.src = "lorenzzo-combate.png";
const pose = Object.freeze({
  idle:0, walk:1, coil:5, rise:6, apex:7, fall:8, land:9,
  dashStart:10, dashDrive:11, dashExtend:12, dashRecover:13, stagger:14,
});
const DASH_DURATION = .185;
const LANDING_DURATION = .16;
const whipHands = [[-20,-28],[-23,-41],[29,-38],[33,-39],[10,-27]];
const originalWhipHands = [[-22,-43],[15,-34],[23,-49],[29,-33],[17,-31]];
const gunHands = [[25,-49],[25,-52],[24,-50]];
const originalGunHands = [[24,-46],[27,-46],[25,-47]];

const platforms = [
  {x:0, w:976, y:444, ground:true}, {x:1230, w:1610, y:444, ground:true},
  {x:315, w:245, y:242, name:"bell"}, {x:746, w:75, y:375}, {x:806, w:90, y:308}, {x:827, w:174, y:242, name:"jump"},
  {x:1006, w:62, y:409}, {x:1115, w:63, y:379},
  {x:1370, w:112, y:374}, {x:1507, w:108, y:327}, {x:1702, w:100, y:373},
  {x:2248, w:88, y:367}, {x:2358, w:82, y:312}, {x:2471, w:202, y:261, name:"relic"},
];
const bridge = {x:974, w:258, y:444, name:"bridge"};
const shrines = [
  {x:160, y:444, name:"Santuário do átrio"}, {x:1290, y:444, name:"Santuário da nave"}, {x:2070, y:444, name:"Santuário da cripta"}
];
const enemySpecs = [
  {x:532, lo:451, hi:650, hp:2, kind:"penitente"},
  {x:1378, lo:1360, hi:1535, hp:2, kind:"penitente"},
  {x:1760, lo:1683, hi:1877, hp:3, kind:"penitente"},
  {x:2435, lo:2310, hi:2610, hp:4, kind:"guardião"},
];
const tutorial = {
  start:["Explore as ruínas", "Siga para a direita. O caminho do campanário fica acima do átrio."],
  crypt:["Encontre a relíquia", "Suba pelos degraus no fundo da cripta. A relíquia está no altar."],
  return:["Volte ao campanário", "A ponte abriu. Volte ao átrio, suba os três degraus e use pulo + Shift para cruzar o vão à esquerda."],
  end:["O sino voltou a tocar", "Você atravessou as ruínas e abriu o caminho do campanário."],
};
let mode = "title", stage, player, enemies, bullets, particles, drops;
let checkpoint = 0, dashUnlocked = false, camera = 0, elapsed = 0, toastUntil = 0, shake = 0;
let audioContext, sound = false;

function objective(next) {
  if (next === stage) return;
  stage = next;
  el("objective-title").textContent = tutorial[stage][0];
  el("objective-text").textContent = tutorial[stage][1];
}
function spawn() {
  const shrine = shrines[checkpoint];
  player = {x:shrine.x, y:shrine.y, vx:0, vy:0, face:1, ground:true, coyote:0, buffer:0,
    hp:FULL_HP, ammo:FULL_AMMO, inv:0, hurt:0, action:null, actionTime:0,
    dashTime:0, dashUsed:false, walk:0, moveTime:0, landing:0, dashRecovery:0};
  enemies = enemySpecs.map(e => ({...e, y:444, maxHp:e.hp, face:-1, wind:0, cooldown:.35, flash:0}));
  bullets = []; particles = []; drops = []; shake = 0;
  camera = clamp(player.x - W * .42, 0, WORLD - W);
  el("checkpoint").textContent = shrine.name;
  toastUntil = 0;
  el("toast").hidden = true;
  updateUI();
}
function newRun() {
  checkpoint = 0;
  dashUnlocked = false;
  objective("start");
  spawn();
  setMode("playing");
}
function setMode(next) {
  mode = next;
  held.clear(); pressed.clear();
  el("pause").disabled = !["playing", "paused"].includes(mode);
  el("pause").textContent = mode === "paused" ? "Continuar" : "Pausar";
  el("overlay").hidden = mode === "playing";
  el("reset").hidden = mode !== "paused";
  if (mode === "playing") {
    canvas.focus({preventScroll:true});
    return;
  }
  el("prompt").hidden = true;
  const views = {
    paused:["PAUSA", "Partida pausada", "Sua exploração continua do ponto em que parou.", "Continuar"],
    dead:["SANTUÁRIO", "Lorenzzo caiu.", "Volte ao último santuário com vida e munição restauradas.", "Tentar de novo"],
    won:["CAPELA EXPLORADA", "O sino voltou a tocar.", "Você encontrou a relíquia e alcançou o campanário. Fim do protótipo.", "Jogar de novo"]
  };
  if (views[mode]) {
    const [kicker, title, message, button] = views[mode];
    el("overlay-kicker").textContent = kicker;
    el("overlay-title").textContent = title;
    el("overlay-text").textContent = message;
    el("primary").firstChild.textContent = button + " ";
    el("primary").focus({preventScroll:true});
  }
}
function say(message, seconds=2.8) {
  el("toast").textContent = message;
  el("toast").hidden = false;
  toastUntil = elapsed + seconds;
}
function uiMarks(id, count, max, label) {
  const holder = el(id);
  const value = count + " de " + max + " " + label;
  if (holder.getAttribute("aria-label") === value && holder.childElementCount) return;
  holder.setAttribute("aria-label", value);
  holder.replaceChildren(...Array.from({length:max}, (_,i) => {
    const mark = document.createElement("i");
    mark.className = i < count ? "" : "empty";
    return mark;
  }));
}
function updateUI() {
  uiMarks("health", player.hp, FULL_HP, "de vida");
  uiMarks("ammo", player.ammo, FULL_AMMO, "cartuchos");
  const zone = player.x < 976 ? 0 : player.x < 1920 ? 1 : 2;
  el("location").textContent = regions[zone];
  el("map-marker").parentElement.style.setProperty("--progress", (player.x / WORLD * 100) + "%");
  document.querySelectorAll(".map-node").forEach((node,i) => node.classList.toggle("active", i === zone));
  el("dash-guide").classList.toggle("locked", !dashUnlocked);
}

function sfx(freq, seconds=.15, tail=.62, shape="triangle") {
  if (!sound || !audioContext) return;
  const start = audioContext.currentTime, tone = audioContext.createOscillator(), gain = audioContext.createGain();
  tone.type = shape;
  tone.frequency.setValueAtTime(freq, start);
  tone.frequency.exponentialRampToValueAtTime(freq * tail, start + seconds);
  gain.gain.setValueAtTime(.052, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + seconds);
  tone.connect(gain).connect(audioContext.destination);
  tone.start(start); tone.stop(start + seconds);
}
function burst(x,y,color,count=9) {
  for (let i=0; i<count; i++) {
    particles.push({x,y,vx:(Math.random()-.5)*155,vy:-25-Math.random()*135,t:.21+Math.random()*.28,color});
  }
}
function enemyHit(enemy, damage) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flash = .16;
  enemy.wind = 0;
  enemy.cooldown = .62;
  burst(enemy.x, enemy.y - 33, enemy.hp ? "#eab482" : "#ac627e");
  shake = .12;
  sfx(100,.1,.55);
  if (!enemy.hp) drops.push({x:enemy.x, y:enemy.y-15});
}
function damage(direction, fromFall=false) {
  if (player.inv > 0 && !fromFall) return;
  player.hp = Math.max(0, player.hp - 1);
  player.inv = 1.04;
  player.hurt = .31;
  player.action = null;
  player.dashTime = 0;
  player.vx = direction * 245; player.vy = -260; player.ground = false;
  shake = .28;
  if (fromFall) {
    const shrine = shrines[checkpoint];
    player.x = shrine.x; player.y = shrine.y; player.vx = 0; player.vy = 0;
    player.ground = true; player.hurt = 0; player.dashUsed = false;
    player.landing = 0; player.dashRecovery = 0;
    camera = clamp(player.x - W*.42, 0, WORLD-W);
  }
  sfx(78,.24,.4,"sawtooth");
  updateUI();
  if (!player.hp) setMode("dead");
}
function attack(type) {
  if (type === "shoot" && !player.ammo) {
    say("Sem munição. Use o chicote ou descanse no santuário.");
    sfx(118,.09);
    return;
  }
  player.action = type;
  player.actionTime = 0;
  player.actionHit = false;
}
function updateAttack(dt) {
  if (!player.action) return;
  player.actionTime += dt;
  const whip = player.action === "whip";
  const time = player.actionTime;
  if (!player.actionHit && time >= (whip ? .13 : .12)) {
    player.actionHit = true;
    if (whip) {
      sfx(240,.13,.36,"sawtooth");
      for (const e of enemies) {
        const distance = (e.x-player.x)*player.face;
        if (e.hp && distance >= -7 && distance <= 117 && range(e.y,player.y,46)) enemyHit(e,1);
      }
    } else {
      player.ammo--;
      const x = player.x + 58 * player.face, y = player.y - 46;
      bullets.push({x,y,from:player.x + 8*player.face,vx:player.face*790,t:.58});
      burst(x,y,"#ffcf81",6);
      sfx(105,.16,.42,"square");
      shake = .11;
    }
  }
  if (time >= (whip ? .36 : .33)) player.action = null;
}
function interact() {
  let hint = "";
  const shrine = shrines.find(s => range(s.x,player.x,51) && range(s.y,player.y,27));
  if (shrine) {
    hint = "[E] Descansar no santuário";
    if (pressed.has("KeyE")) {
      checkpoint = shrines.indexOf(shrine);
      player.hp = FULL_HP; player.ammo = FULL_AMMO;
      el("checkpoint").textContent = shrine.name;
      say("Vida e munição restauradas.");
      burst(shrine.x,shrine.y-42,"#b2e7d5",15);
      sfx(450,.26,1.46);
    }
  }
  if (range(player.x,2571,57) && range(player.y,261,33) && !dashUnlocked) {
    hint = "[E] Pegar a Relíquia do Véu";
    if (pressed.has("KeyE")) {
      dashUnlocked = true;
      objective("return");
      say("Relíquia do Véu · Dash aéreo liberado. A ponte abriu.",4);
      burst(2571,217,"#a8f2df",30);
      sfx(355,.42,1.85);
      hint = "";
    }
  }
  if (range(player.x,406,59) && range(player.y,242,32) && dashUnlocked) {
    hint = "[E] Tocar o sino";
    if (pressed.has("KeyE")) {
      objective("end");
      sfx(330,.8,.75,"sine");
      setMode("won");
      hint = "";
    }
  }
  if (!hint && dashUnlocked && player.x >= 827 && player.x <= 994 && range(player.y,242,24)) hint = "← Segure esquerda, pule e use Shift no ar";
  el("prompt").textContent = hint;
  el("prompt").hidden = !hint;
}
function update(dt) {
  const p = player;
  elapsed += dt;
  if (elapsed >= toastUntil && !el("toast").hidden) el("toast").hidden = true;
  p.inv = Math.max(0,p.inv-dt);
  p.hurt = Math.max(0,p.hurt-dt);
  p.landing = Math.max(0,p.landing-dt);
  p.dashRecovery = Math.max(0,p.dashRecovery-dt);
  shake = Math.max(0,shake-dt);
  if (p.ground) p.coyote = .095;
  else p.coyote -= dt;
  if (pressed.has("Space") || pressed.has("KeyW") || pressed.has("ArrowUp")) p.buffer = .12;
  else p.buffer -= dt;
  const direction = Number(held.has("KeyD") || held.has("ArrowRight")) - Number(held.has("KeyA") || held.has("ArrowLeft"));
  if (!p.hurt && !p.dashTime) {
    if (direction && !p.action) p.face = direction;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -540; p.ground = false; p.coyote = 0; p.buffer = 0;
      p.landing = 0; p.dashRecovery = 0;
      burst(p.x,p.y,"#7e656e",5);
      sfx(194,.12,1.4);
    }
    if ((pressed.has("ShiftLeft") || pressed.has("ShiftRight")) && dashUnlocked && !p.dashUsed && !p.ground) {
      p.dashUsed = true; p.dashTime = DASH_DURATION; p.action = null;
      p.landing = 0;
      p.face = direction || p.face; p.vy = 0;
      sfx(410,.2,.53);
    } else if (!p.action && !p.dashTime) {
      if (pressed.has("KeyJ")) attack("whip");
      else if (pressed.has("KeyK")) attack("shoot");
    }
  }
  updateAttack(dt);
  if (p.dashTime > 0) {
    p.dashTime = Math.max(0,p.dashTime-dt);
    if (!p.dashTime) p.dashRecovery = .095;
    p.vx = 865*p.face; p.vy = 0;
    if (Math.random() < .7) burst(p.x-p.face*13,p.y-25,"#78b5a9",2);
  } else {
    const speed = direction * (p.action && p.ground ? 92 : 254);
    const target = p.hurt ? p.vx*.96 : speed;
    p.vx += (target-p.vx)*Math.min(1,dt*(direction ? 22 : 29));
    p.vy = Math.min(710,p.vy+1280*dt);
  }
  const lastY = p.y;
  p.x = clamp(p.x+p.vx*dt,15,WORLD-19);
  p.y += p.vy*dt;
  p.ground = false;
  if (p.vy >= 0) {
    const surfaces = dashUnlocked ? [...platforms,bridge] : platforms;
    const land = surfaces.filter(s => p.x+8 > s.x && p.x-8 < s.x+s.w && lastY <= s.y && p.y >= s.y)
      .sort((a,b) => a.y-b.y)[0];
    if (land) {
      if (p.vy > 130 && !p.hurt) {
        p.landing = LANDING_DURATION;
        p.dashRecovery = 0;
        burst(p.x,land.y,"#82707d",5);
      }
      p.y = land.y; p.vy = 0; p.ground = true; p.dashUsed = false;
    }
  }
  if (p.y > H+96) damage(0,true);
  if (mode !== "playing") return;
  p.walk += Math.abs(p.vx)*dt;
  p.moveTime = p.ground && Math.abs(p.vx)>14 ? p.moveTime+dt : 0;
  for (const e of enemies) {
    if (!e.hp) continue;
    const distance = p.x-e.x;
    const near = Math.abs(distance) < 160 && range(p.y,e.y,63);
    e.flash = Math.max(0,e.flash-dt);
    e.cooldown = Math.max(0,e.cooldown-dt);
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) {
        const front = (p.x-e.x)*e.face;
        if (front > -12 && front < 63 && range(p.y,e.y,40)) damage(e.face);
        e.cooldown = .78;
        burst(e.x+e.face*20,e.y-29,"#ab6a79",4);
      }
    } else if (!e.flash) {
      if (near) e.face = Math.sign(distance) || e.face;
      if (near && Math.abs(distance) < 49 && e.cooldown === 0) {
        e.wind = e.kind === "guardião" ? .35 : .42;
      } else if (!near || Math.abs(distance) > 39) {
        e.x += e.face*dt*(near ? 83 : 32);
        if (e.x <= e.lo || e.x >= e.hi) {
          e.x = clamp(e.x,e.lo,e.hi);
          e.face = e.x === e.lo ? 1 : -1;
        }
      }
    }
  }
  if (mode !== "playing") return;
  for (const bullet of bullets) {
    const previousX = bullet.from ?? bullet.x;
    bullet.from = null;
    bullet.x += bullet.vx*dt; bullet.t -= dt;
    const hit = enemies.filter(e => e.hp && Math.max(previousX,bullet.x) >= e.x-17 && Math.min(previousX,bullet.x) <= e.x+17 && bullet.y > e.y-63 && bullet.y < e.y-8)
      .sort((a,b) => Math.abs(a.x-previousX)-Math.abs(b.x-previousX))[0];
    if (hit) { enemyHit(hit,2); bullet.t = 0; }
  }
  bullets = bullets.filter(b => b.t > 0);
  drops = drops.filter(drop => {
    if (range(p.x,drop.x,23) && range(p.y,drop.y,31) && p.ammo < FULL_AMMO) {
      p.ammo++; sfx(520,.1,1.5); return false;
    }
    return true;
  });
  for (const particle of particles) {
    particle.x += particle.vx*dt; particle.y += particle.vy*dt; particle.vy += 240*dt; particle.t -= dt;
  }
  particles = particles.filter(particle => particle.t > 0);
  if (!dashUnlocked && p.x > 1960) objective("crypt");
  if (checkpoint < 1 && p.x >= 1260 && p.x < 1360 && p.ground) {
    checkpoint = 1; el("checkpoint").textContent = shrines[1].name;
    say("Santuário da nave encontrado. Use E para descansar.");
  }
  if (checkpoint < 2 && p.x >= 2030 && p.x < 2130 && p.ground) {
    checkpoint = 2; el("checkpoint").textContent = shrines[2].name;
    say("Santuário da cripta encontrado.");
  }
  interact();
  camera += (clamp(p.x - W*.42,0,WORLD-W)-camera)*Math.min(1,dt*6);
  updateUI();
}

function polygon(target, points, color) {
  target.fillStyle = color;
  target.beginPath();
  points.forEach(([x,y],i) => i ? target.lineTo(x,y) : target.moveTo(x,y));
  target.closePath(); target.fill();
}
function line(target, points, color, width=1) {
  target.strokeStyle = color;
  target.lineWidth = width;
  target.beginPath();
  points.forEach(([x,y],i) => i ? target.lineTo(x,y) : target.moveTo(x,y));
  target.stroke();
}
function arch(target,x,y,w,h) {
  target.beginPath();
  target.moveTo(x-w/2,y+h); target.lineTo(x-w/2,y+w*.68);
  target.quadraticCurveTo(x-w/2,y+w*.22,x,y);
  target.quadraticCurveTo(x+w/2,y+w*.22,x+w/2,y+w*.68);
  target.lineTo(x+w/2,y+h); target.closePath();
}
function grain(x,y) {
  const raw = Math.sin(x*37.18+y*61.75)*43758.5453;
  return raw - Math.floor(raw);
}
function glow(target,x,y,r,rgb,opacity=.22) {
  const gradient = target.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,"rgba("+rgb+","+opacity+")");
  gradient.addColorStop(1,"rgba("+rgb+",0)");
  target.fillStyle = gradient; target.fillRect(x-r,y-r,r*2,r*2);
}
function background(zone) {
  const image = document.createElement("canvas");
  image.width = W; image.height = H;
  const g = image.getContext("2d");
  const skies = [
    ["#151323","#3e2b43","#191320"],
    ["#181928","#49404e","#1c1828"],
    ["#171626","#393746","#151523"]
  ][zone];
  const fill = g.createLinearGradient(0,0,0,H);
  skies.forEach((color,i) => fill.addColorStop(i/2,color));
  g.fillStyle=fill; g.fillRect(0,0,W,H);
  const daylight = zone === 0 ? "205,154,153" : zone === 1 ? "171,187,216" : "149,177,172";
  glow(g,zone === 1 ? 202 : 528,182,360,daylight,.29);

  for(let x=0; x<W; x+=5) {
    const roof = 385-grain(x,zone)*42-(x%155<20 ? 23 : 0);
    g.fillStyle = zone === 1 ? "#272438" : "#2a2033";
    g.fillRect(x,roof,5,H-roof);
  }
  for(let y=42; y<452; y+=25) {
    for(let x=-30; x<W; x+=59) {
      const off = (Math.floor(y/25)%2)*29;
      g.fillStyle = grain(x,y) > .62 ? "#8161731c" : "#140e2053";
      g.fillRect(x+off,y,56,22);
      g.fillStyle = "#ae839119";
      g.fillRect(x+off+2,y+2,Math.floor(grain(x+3,y)*37),1);
    }
  }
  const windows = zone === 0 ? [156,467,769] : zone === 1 ? [190,490,781] : [145,436,738];
  for(const [i,x] of windows.entries()) {
    const y = 57+(i%2)*16, w = i === 1 ? 142 : 106, h=273;
    arch(g,x,y-13,w+31,h+24); g.fillStyle="#191523"; g.fill();
    g.lineWidth=3; g.strokeStyle="#644d5e"; g.stroke();
    g.save(); arch(g,x,y,w,h); g.clip();
    const light=g.createLinearGradient(x,y,x,y+h);
    light.addColorStop(0,zone===0 ? "#746070" : zone===1 ? "#7b829c" : "#526a70");
    light.addColorStop(.7,zone===0 ? "#a17378" : zone===1 ? "#8d7e9c" : "#668780");
    light.addColorStop(1,"#453248");
    g.fillStyle=light; g.fillRect(x-w,y,w*2,h+4);
    for(let tile=-4; tile<6; tile++) for(let j=0;j<14;j++) {
      const xx=x+tile*18+(j%2)*9, yy=y+j*21;
      const colors=zone===2 ? ["#507169","#759087","#6e737f","#ab999b"] : ["#674d66","#976975","#766582","#c2918d"];
      polygon(g,[[xx,yy-10],[xx+9,yy],[xx,yy+10],[xx-9,yy]],colors[Math.floor(grain(xx,yy)*4)]);
      line(g,[[xx-9,yy],[xx,yy+10],[xx+9,yy],[xx,yy-10],[xx-9,yy]],"#38263d",1.4);
    }
    g.fillStyle="#241d30"; g.fillRect(x-2,y,4,h);
    for(let yy=y+62; yy<y+h; yy+=45) g.fillRect(x-w/2,yy,w,3);
    g.strokeStyle="#d5aab275"; g.lineWidth=2; g.beginPath(); g.arc(x,y+80,25,0,Math.PI*2); g.stroke();
    line(g,[[x-18,y+80],[x+18,y+80]],"#d7aeb396",2);
    line(g,[[x,y+59],[x,y+101]],"#d7aeb396",2);
    g.restore();
    arch(g,x,y,w,h); g.strokeStyle="#302438"; g.lineWidth=5; g.stroke();
    g.fillStyle="#221827"; g.fillRect(x-w*.62,y+h,w*1.24,11);
    glow(g,x,y+h-22,100,daylight,.12);
    polygon(g,[[x-w*.29,y+148],[x+w*.46,y+151],[x+w*1.4,443],[x+w*.13,443]],"rgba("+daylight+",.043)");
  }
  for(const x of [0,309,615,927]) {
    g.fillStyle="#1d1725"; g.fillRect(x-17,0,36,444);
    g.fillStyle="#372737"; g.fillRect(x-11,0,5,443);
    g.fillStyle="#523746"; g.fillRect(x-5,0,2,443);
    g.fillStyle="#2d2230"; g.fillRect(x-25,410,50,20);
    g.fillStyle="#211925"; g.fillRect(x-30,429,61,15);
    g.fillStyle="#483342"; g.fillRect(x-25,409,50,3);
  }
  for(let i=0;i<14;i++) {
    const x=Math.floor(grain(i+60,zone)*W), height=16+Math.floor(grain(i,zone+33)*60);
    polygon(g,[[x-19,444],[x-9,444-height*.75],[x,444-height],[x+6,444-height*.72],[x+10,444]],"#201725");
  }
  return image;
}
const backdrops = [0,1,2].map(background);
const vignette = ctx.createRadialGradient(W*.53,H*.48,185,W*.53,H*.48,570);
vignette.addColorStop(0,"#100b1400"); vignette.addColorStop(1,"#08060c96");

function stone(surface, offset) {
  const {x,w,y,ground,name} = surface;
  const start = Math.max(x,Math.floor(offset/36)*36-36);
  const end = Math.min(x+w,offset+W+40);
  if (end <= start) return;
  if (name === "bridge") {
    ctx.fillStyle="#211c29"; ctx.fillRect(x,y,w,24);
    for(let i=x;i<x+w;i+=18) {
      ctx.fillStyle=i%3===0 ? "#6f7772" : "#454451"; ctx.fillRect(i,y,Math.min(15,x+w-i),6);
      ctx.fillStyle="#6f9a8d"; ctx.fillRect(i+3,y+9,3,3);
    }
    return;
  }
  const depth = ground ? 112 : 28;
  ctx.fillStyle="#211724"; ctx.fillRect(start,y,end-start,depth);
  for (let row=0; row*12<depth; row++) {
    for(let tile=x-(row%2)*18; tile<x+w; tile+=36) {
      if(tile+36<start || tile>end) continue;
      const left=Math.max(x,tile), width=Math.min(tile+35,x+w)-left;
      if(width<=0) continue;
      const pick=grain(tile,row+y);
      ctx.fillStyle = (row===0 ? ["#53404c","#473544","#604955"] : ["#332533","#3a2b38","#2d2130"])[Math.floor(pick*3)];
      ctx.fillRect(left,y+row*12,width,10);
      ctx.fillStyle = row===0 ? "#af857b" : "#553f4a"; ctx.fillRect(left,y+row*12,width,1);
      ctx.fillStyle="#231925"; ctx.fillRect(left+3,y+row*12+5,Math.min(8,width-3),1);
    }
  }
  if (ground) for(let tile=Math.ceil(start/14)*14;tile<end;tile+=14) {
    const height=grain(tile,0)*11;
    if(height>7) line(ctx,[[tile,y],[tile+3,y-height],[tile+6,y]],"#77605b");
  }
}
function marker(x,y,color,size=5) {
  polygon(ctx,[[x,y-size],[x+size,y],[x,y+size],[x-size,y]],color);
}
function lamp(x,y,color,clock) {
  const flicker=1+Math.sin(clock*12+x)*.12;
  glow(ctx,x,y-16,47*flicker,color,.36);
  ctx.fillStyle="#30202c"; ctx.fillRect(x-7,y-8,14,5);
  ctx.fillStyle="#a88c70"; ctx.fillRect(x-5,y-6,10,2);
  polygon(ctx,[[x-3,y-9],[x-4,y-14],[x,y-23*flicker],[x+3,y-16],[x+3,y-9]],"rgba("+color+",.87)");
  ctx.fillStyle="#fce9ca"; ctx.fillRect(x-1,y-15,2,6);
}
function scenery(t) {
  for(const s of shrines) {
    glow(ctx,s.x,s.y-35,95,"119,211,189",.16);
    polygon(ctx,[[s.x-23,s.y],[s.x-17,s.y-41],[s.x,s.y-66],[s.x+17,s.y-41],[s.x+23,s.y]],"#261f2c");
    line(ctx,[[s.x-19,s.y-2],[s.x-14,s.y-40],[s.x,s.y-61],[s.x+14,s.y-40],[s.x+19,s.y-2]],"#795f65",2);
    marker(s.x,s.y-41,"#9cd9c7",7);
    marker(s.x,s.y-41,"#e3f5d7",3);
    lamp(s.x-26,s.y,"129,219,195",t); lamp(s.x+26,s.y,"129,219,195",t);
  }
  for(const x of [247,695,936,1328,1637,1960,2186,2760]) {
    ctx.fillStyle="#352636"; ctx.fillRect(x-1,401,3,43); ctx.fillRect(x-10,441,21,3);
    lamp(x,401,"231,153,100",t);
  }
  const bx = 406, by = 242;
  ctx.fillStyle="#211725"; ctx.fillRect(bx-43,by-115,7,114); ctx.fillRect(bx+37,by-115,7,114);
  ctx.fillStyle="#493543"; ctx.fillRect(bx-48,by-118,96,9);
  line(ctx,[[bx-50,by-120],[bx,by-156],[bx+50,by-120]],"#785a62",3);
  ctx.fillStyle="#735955"; ctx.fillRect(bx-2,by-109,4,13);
  const swing = mode === "won" ? Math.sin(t*6)*.13 : 0;
  ctx.save(); ctx.translate(bx,by-96); ctx.rotate(swing);
  polygon(ctx,[[-9,0],[9,0],[14,22],[21,35],[-21,35],[-14,22]],"#9b7256");
  polygon(ctx,[[-6,3],[2,3],[4,23],[8,32],[-13,32],[-8,22]],"#c29970");
  ctx.fillStyle="#ddaf7a"; ctx.fillRect(-22,33,44,4);
  ctx.fillStyle="#704f47"; ctx.fillRect(-3,36,6,6);
  ctx.restore();
  lamp(bx-51,by,"234,161,104",t); lamp(bx+51,by,"234,161,104",t);
  const rx=2571, ry=261;
  polygon(ctx,[[rx-26,ry],[rx-15,ry-36],[rx+15,ry-36],[rx+26,ry]],"#2b2533");
  ctx.fillStyle="#a88a79"; ctx.fillRect(rx-23,ry-37,46,3);
  lamp(rx-48,ry,"129,219,195",t); lamp(rx+48,ry,"129,219,195",t);
  if(!dashUnlocked) {
    const fy=ry-59+Math.sin(t*3)*5;
    glow(ctx,rx,fy,89,"130,223,201",.47);
    marker(rx,fy,"#87d5be",13); marker(rx,fy,"#d0f7df",8); marker(rx,fy,"#fcf8da",3);
  }
  if (!dashUnlocked) {
    for (const x of [986,1219]) {
      ctx.fillStyle="#574150"; ctx.fillRect(x-7,414,14,30);
      marker(x,424,"#aa7680",4);
    }
  }
  for(let i=0;i<50;i++) {
    const x=(grain(i,3)*WORLD+t*(3+grain(i,6)*9))%WORLD;
    const y=40+grain(i,9)*400+Math.sin(t*.8+i)*7;
    ctx.fillStyle=i%4===0 ? "#c9958280" : "#dfd0c64b";
    ctx.fillRect(Math.floor(x),Math.floor(y),i%3===0 ? 2 : 1,i%3===0 ? 2 : 1);
  }
}
function drawEnemy(e,t) {
  if(!e.hp) return;
  ctx.save(); ctx.translate(Math.round(e.x),e.y); ctx.scale(e.face,1);
  const tall=e.kind==="guardião", h=tall ? 78 : 62, step=Math.sin(t*13+e.x*.03)*5;
  const color=e.flash ? "#edb195" : tall ? "#5c424d" : "#654655";
  const glowColor=e.wind>0 ? "#ffd09a" : "#eb8a8a";
  ctx.fillStyle="#130e17a0"; ctx.fillRect(-24,-3,46,3);
  line(ctx,[[-9,-24],[-10+step,-8],[-15+step,-2]],"#201722",8);
  line(ctx,[[8,-24],[6-step,-10],[13-step,-2]],"#291b26",8);
  polygon(ctx,[[-15,-h+20],[-24,-13],[-7,-9],[1,-18],[13,-9],[19,-23],[13,-h+21]],color);
  polygon(ctx,[[-16,-h+23],[-12,-h+12],[-6,-h+4],[5,-h],[13,-h+12],[15,-h+25],[0,-h+30]],"#271c2a");
  line(ctx,[[-14,-h+23],[-11,-h+13],[-5,-h+4],[5,-h+1],[12,-h+13]],color,3);
  polygon(ctx,[[0,-h+13],[14,-h+13],[12,-h+22],[3,-h+21]],"#a57e77");
  ctx.fillStyle=glowColor; ctx.fillRect(6,-h+15,9,2);
  const arm=e.wind>0 ? -16 : 14;
  line(ctx,[[5,-h+31],[10,-h+24],[arm,-h+37]],color,8);
  line(ctx,[[arm-2,-h+39],[arm+16,-h+18],[arm+21,-h+10]],"#ba8f89",3);
  line(ctx,[[arm-2,-h+39],[arm+16,-h+18]],"#4e3946");
  if(e.wind>0) {
    glow(ctx,1,-h-11,28,"239,151,113",.3);
    marker(1,-h-11,glowColor,4);
  }
  for(let i=0;i<e.maxHp;i++) {
    ctx.fillStyle=i<e.hp ? "#d98187" : "#4f3b4b";
    ctx.fillRect(i*7-e.maxHp*3.5,-h-23,5,2);
  }
  ctx.restore();
}
function movementPose(p) {
  if (p.hurt) return pose.stagger;
  if (p.dashTime) {
    const phase = (DASH_DURATION-p.dashTime)/DASH_DURATION;
    return phase < .18 ? pose.dashStart : phase < .70 ? pose.dashDrive : pose.dashExtend;
  }
  if (p.dashRecovery && !p.ground) return pose.dashRecover;
  if (!p.ground) {
    if (p.vy < -480) return pose.coil;
    if (p.vy < -95) return pose.rise;
    return p.vy < 95 ? pose.apex : pose.fall;
  }
  if (p.landing > .045) return pose.land;
  const speed = Math.abs(p.vx);
  if (speed < 14) return pose.idle;
  if (speed < 180 || p.moveTime < .17) return pose.walk + Math.floor(p.moveTime/.044)%4;
  return null;
}
function drawNewFrame(image, frame, offset=0) {
  const width=104, height=86;
  ctx.drawImage(image,(frame%5)*width,Math.floor(frame/5)*height,width,height,-60+offset,-77,width,height);
}
function drawOriginalFrame(frame) {
  ctx.drawImage(atlas,(frame%6)*128,Math.floor(frame/6)*128,128,128,-42,-73,77,77);
}
function drawPlayer(t) {
  const p=player;
  const action=p.actionTime;
  let f=Math.floor(t*4)%7;
  if(p.hurt) f=13+Math.min(3,Math.floor((.31-p.hurt)*12));
  else if(p.action==="whip") f=18+Math.min(4,Math.floor(action/.072));
  else if(p.action==="shoot") f=23+Math.min(2,Math.floor(action/.11));
  else if(p.dashTime) f=10;
  else if(!p.ground) f=p.vy < 70 ? 9 : 11;
  else if(Math.abs(p.vx)>16) f=7+Math.floor(p.walk/16)%6;

  ctx.save();
  ctx.translate(Math.round(p.x),Math.round(p.y));
  ctx.scale(p.face,1);
  if (p.ground) {
    ctx.fillStyle="#100a14a0"; ctx.fillRect(-19,-2,41,3);
  }
  const flashing = p.inv>0 && !p.hurt && Math.floor(t*19)%2;
  const motion = p.action ? null : movementPose(p);
  const combatReady = combatAtlas.complete && combatAtlas.naturalWidth > 0;
  const motionReady = motionAtlas.complete && motionAtlas.naturalWidth > 0;
  const useCombatPose = combatReady && (p.action || motion === pose.idle || motion === null);
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=flashing ? .47 : 1;
  if (useCombatPose) {
    const runCycle = [0,1,2,4,1,3];
    const idleFrame = 10 + (Math.floor(t*2)%2);
    const frame = p.action === "whip" ? f-13 : p.action === "shoot" ? f-11 :
      motion === pose.idle ? idleFrame : runCycle[Math.floor(p.walk/15)%runCycle.length];
    drawNewFrame(combatAtlas,frame);
  } else if (motion !== null && motionReady) {
    if (p.dashTime && p.dashTime < DASH_DURATION-.034) {
      ctx.globalAlpha=.16;
      drawNewFrame(motionAtlas,motion,-34);
      ctx.globalAlpha=.31;
      drawNewFrame(motionAtlas,motion,-17);
    }
    ctx.globalAlpha=flashing ? .47 : 1;
    drawNewFrame(motionAtlas,motion);
  } else if (atlas.complete && atlas.naturalWidth) {
    ctx.globalAlpha=flashing ? .47 : 1;
    drawOriginalFrame(f);
  } else {
    polygon(ctx,[[-13,0],[-12,-56],[0,-70],[15,-58],[9,0]],"#b68c87");
  }
  if(p.action==="whip") {
    const hand=(useCombatPose ? whipHands : originalWhipHands)[f-18];
    const whipArc = [
      [-43,-52,-62,-30,-63,-12], [5,-86,-3,-83,-31,-64],
      [54,-67,92,-62,116,-35], [65,-35,107,-45,121,-30],
      [55,-22,72,4,88,-12], [24,-28,37,-10,48,-13]
    ];
    const progress = action < .13 ? action/.13*2 : Math.min(4.999,2+(action-.13)/.23*3);
    const segment = Math.floor(progress);
    const blend = progress-segment;
    const curve = whipArc[segment].map((point,i)=>point+(whipArc[segment+1][i]-point)*blend);
    ctx.beginPath(); ctx.moveTo(...hand); ctx.bezierCurveTo(...curve);
    ctx.strokeStyle="#362731"; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle=action>=.13&&action<.25 ? "#e1b993" : "#a98177"; ctx.lineWidth=1.5; ctx.stroke();
  }
  if(p.action==="shoot") {
    const [handX,handY]=(useCombatPose ? gunHands : originalGunHands)[f-23];
    const muzzleX=58, muzzleY=-46;
    // The longest arm is the foot of the cross, turned forward to serve as the muzzle.
    const barX=handX+5;
    line(ctx,[[handX-2,handY],[barX,handY],[muzzleX,muzzleY]],"#251e2b",7);
    line(ctx,[[barX,handY-10],[barX,handY+10]],"#251e2b",7);
    line(ctx,[[handX,handY],[barX,handY],[muzzleX,muzzleY]],"#c7aaa1",3);
    line(ctx,[[barX,handY-10],[barX,handY+10]],"#c7aaa1",3);
    ctx.fillStyle="#f5d7a8"; ctx.fillRect(barX-2,handY-2,4,4);
    ctx.fillStyle="#92717b"; ctx.fillRect(muzzleX-3,muzzleY-2,3,5);
    if(action>=.12&&action<.176) {
      glow(ctx,muzzleX+4,muzzleY,37,"253,156,71",.48);
      polygon(ctx,[[muzzleX,muzzleY],[muzzleX+9,muzzleY-7],[muzzleX+12,muzzleY-3],
        [muzzleX+27,muzzleY],[muzzleX+11,muzzleY+3],[muzzleX+9,muzzleY+6]],"#f8b470");
      ctx.fillStyle="#ffe7ad"; ctx.fillRect(muzzleX,muzzleY-1,15,2);
    }
  }
  ctx.restore();
  ctx.globalAlpha=1;
}
function draw(t) {
  const kick=shake ? Math.sin(t*133)*shake*13 : 0;
  const offset=Math.round(clamp(camera+kick,0,WORLD-W));
  ctx.save(); ctx.translate(-offset,0);
  for(let i=0;i<backdrops.length;i++) {
    if(i*W<offset+W && (i+1)*W>=offset) ctx.drawImage(backdrops[i],i*W,0);
  }
  for(const platform of platforms) stone(platform,offset);
  if(dashUnlocked) stone(bridge,offset);
  scenery(t);
  enemies.forEach(e=>drawEnemy(e,t));
  for(const d of drops) {
    const y=d.y+Math.sin(t*5+d.x)*3;
    glow(ctx,d.x,y,17,"226,179,118",.28);
    ctx.fillStyle="#e9be89"; ctx.fillRect(d.x-2,y-4,4,8);
  }
  for(const b of bullets) {
    ctx.fillStyle="#f0ac66"; ctx.fillRect(b.x-10,b.y,20,2);
    ctx.fillStyle="#ffe6ac"; ctx.fillRect(b.x-4,b.y,8,2);
  }
  drawPlayer(t);
  for(const p of particles) {
    ctx.globalAlpha=Math.min(1,p.t*4);
    ctx.fillStyle=p.color; ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);
  }
  ctx.restore();
  ctx.fillStyle=vignette; ctx.fillRect(0,0,W,H);
}

function press(key) {
  if (!held.has(key)) pressed.add(key);
  held.add(key);
}
window.addEventListener("keydown", e => {
  if (!valid.has(e.code)) return;
  if (e.code === "Escape" && ["playing","paused"].includes(mode) && !e.repeat) {
    e.preventDefault(); setMode(mode === "playing" ? "paused" : "playing");
  } else if (mode === "playing" && !(document.activeElement instanceof HTMLButtonElement)) {
    e.preventDefault(); press(e.code);
  }
});
window.addEventListener("keyup", e=>held.delete(e.code));
window.addEventListener("blur",()=>{ if(mode==="playing") setMode("paused"); });
document.querySelectorAll("[data-key]").forEach(button=>{
  const key=button.dataset.key;
  button.addEventListener("pointerdown",e=>{
    e.preventDefault();
    if(mode!=="playing") return;
    button.setPointerCapture(e.pointerId); press(key);
  });
  for(const event of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(event,()=>held.delete(key));
});
el("primary").addEventListener("click",()=>{
  if(mode==="dead"){ spawn(); setMode("playing"); }
  else if(mode==="paused") setMode("playing");
  else newRun();
});
el("pause").addEventListener("click",()=>setMode(mode==="playing" ? "paused" : "playing"));
el("reset").addEventListener("click",newRun);
el("sound").addEventListener("click",()=>{
  sound=!sound;
  if(sound){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio) { audioContext ??= new Audio(); audioContext.resume().catch(()=>{}); }
    else sound=false;
  }
  el("sound").textContent=sound ? "Som ligado" : "Som desligado";
  el("sound").setAttribute("aria-pressed",String(sound));
  if(mode==="playing") canvas.focus({preventScroll:true});
});
el("fullscreen").addEventListener("click", async ()=>{
  try{
    if(document.fullscreenElement) await document.exitFullscreen();
    else await el("play").requestFullscreen();
  }catch{
    if(mode==="playing") say("Tela cheia indisponível neste navegador.");
  }
  if(mode==="playing") canvas.focus({preventScroll:true});
});
canvas.addEventListener("pointerdown",()=>canvas.focus({preventScroll:true}));
objective("start"); spawn();
let then=0, debt=0;
function frame(now) {
  const delta=then ? Math.min((now-then)/1000,.055) : 0;
  then=now;
  if(mode==="playing") {
    debt+=delta;
    while(debt>=1/120 && mode==="playing"){
      update(1/120);
      pressed.clear(); debt-=1/120;
    }
  } else debt=0;
  draw(now/1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
