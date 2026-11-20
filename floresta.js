"use strict";

/* Prólogo: o treino na floresta do West Blue.
   Cenário em camadas (parallax), treino com Padre Quinn e diálogos que se escrevem. */

const forestWidth = 1880;
const forestGround = 444;
const STREAM = {from:450, to:565};
const forestPlatforms = [
  {x:0,w:STREAM.from,y:forestGround}, {x:STREAM.to,w:forestWidth-STREAM.to,y:forestGround}
];
const exercises = [
  {label:"Travessia", title:"Atravesse o riacho", text:"Siga para a direita com A/D ou as setas. Pule com Espaço antes da margem.", place:"Trilha da Ordem"},
  {label:"Chicote", title:"Corte as cordas", text:"Aproxime-se dos dois sacos de palha e use J para cortar a corda.", place:"Trilha da Ordem"},
  {label:"Pistola-cruz", title:"Acerte os alvos", text:"Pare na marca dourada e use K. A caixa ao lado repõe os cartuchos (E).", place:"Clareira de tiro"},
  {label:"Concluído", title:"Treino concluído", text:"Você atravessou o riacho e completou os dois exercícios de combate.", place:"Clareira de tiro"}
];
const talks = {
  opening:[
    ["mentor","Antes de pegar no chicote, quero que entenda por que a Ordem caça, Lorenzzo."],
    ["mentor","O mar é nosso Deus. Há poderes que mal compreendemos, e há quem os use para pôr a vontade dos outros debaixo da sua."],
    ["mentor","Quando alguém toma esse poder para si e o usa contra os outros, é como tirar algo de Deus sem pedir. É esse abuso que juramos impedir."],
    ["lorenzzo","E como eu vou saber quando alguém está abusando?"],
    ["mentor","Ouvindo quem sofreu as consequências. A arma vem depois. Agora atravesse o riacho. Quero ver como você salta."]
  ],
  whip:[
    ["mentor","Muito bem. Pendurei dois sacos de palha na trilha. Chegue perto e corte as cordas com o chicote."],
    ["lorenzzo","Os dois? O segundo está bem mais longe."],
    ["mentor","Então caminhe até ele. Aprenda a medir a distância antes de estalar o braço."]
  ],
  shot:[
    ["mentor","Agora a pistola-cruz. Segure pelo centro. A ponta de baixo da cruz fica voltada para o alvo."],
    ["mentor","Fique na marca no chão. Inspire, firme as mãos e só então aperte o gatilho. Tem mais cartuchos na caixa."]
  ],
  finish:[
    ["lorenzzo","Acertei os dois, Padre."],
    ["mentor","Acertou. Agora guarde a arma. Quem aprende a usar força precisa aprender a hora de baixar a mão também."]
  ]
};
const names = {mentor:"Padre Quinn", lorenzzo:"Lorenzzo"};
const mentorSpots = [250, 700, 1150, 1150];
const childAtlas = new Image();
childAtlas.src = "lourenzzo-seminarista.png";
let forest = null;
let layers = null;
let leaves = [];

/* ---------- Estado do treino ---------- */
function clearTalk() {
  el("dialogue").hidden = true;
  el("frame-content").inert = false;
  el("touch-controls").inert = false;
  el("pause").disabled = mode !== "playing" && mode !== "paused";
}
function selectForest(showIntro) {
  forest = {
    step:0, talk:null, index:0, count:0, typing:null,
    mentor:{x:mentorSpots[0], face:1, walk:0, moving:false},
    targets:[
      {x:818,y:405,type:"whip",hit:false,fall:0},
      {x:1018,y:405,type:"whip",hit:false,fall:0},
      {x:1430,y:414,type:"shoot",hit:false,fall:0},
      {x:1638,y:414,type:"shoot",hit:false,fall:0}
    ]
  };
  clearTalk();
  spawn();
  forestObjective();
  if (!showIntro) return;
  setMode("playing");
  openTalk("opening");
}
function typeLine(text) {
  clearInterval(forest.typing);
  const box = el("dialogue-line");
  box.textContent = "";
  box.setAttribute("aria-label", text);
  let i = 0;
  forest.typing = setInterval(() => {
    i = Math.min(text.length, i + 2);
    box.textContent = text.slice(0, i);
    if (i % 6 === 0) sfx(820 + Math.random()*120, .025, 1, "triangle", .008);
    if (i >= text.length) { clearInterval(forest.typing); forest.typing = null; }
  }, 22);
}
function showTalk() {
  const [speaker,line] = forest.talk[forest.index];
  const last = forest.index === forest.talk.length-1;
  el("dialogue").dataset.speaker = speaker;
  el("speaker").textContent = names[speaker];
  el("dialogue-count").textContent = (forest.index+1)+" / "+forest.talk.length;
  el("dialogue-next").textContent = last ? (forest.step === 3 ? "Encerrar o treino →" : "Começar exercício →") : "Continuar →";
  typeLine(line);
}
function openTalk(key) {
  held.clear(); pressed.clear();
  player.vx = 0;
  forest.talk = talks[key];
  forest.index = 0;
  el("prompt").hidden = true;
  el("toast").hidden = true;
  el("frame-content").inert = true;
  el("touch-controls").inert = true;
  el("pause").disabled = true;
  el("dialogue").hidden = false;
  showTalk();
  el("dialogue-next").focus({preventScroll:true});
}
function advanceTalk() {
  if (!forest?.talk) return;
  if (forest.typing) {
    clearInterval(forest.typing); forest.typing = null;
    el("dialogue-line").textContent = forest.talk[forest.index][1];
    return;
  }
  forest.index++;
  if (forest.index < forest.talk.length) { showTalk(); return; }
  forest.talk = null;
  clearTalk();
  if (forest.step === 3) setMode("won");
  else canvas.focus({preventScroll:true});
}
function forestObjective() {
  const exercise = exercises[forest.step];
  el("objective-title").textContent = exercise.title;
  el("objective-text").textContent = exercise.text;
  const done = forest.step === 1 || forest.step === 2 ? " · "+forest.count+"/2 alvos" : "";
  el("training-step").textContent = exercise.label + done;
  el("location").textContent = exercise.place;
  el("checkpoint").textContent = forest.step === 3 ? "Treino concluído" : "Exercício "+(forest.step+1)+" de 3";
  document.querySelectorAll(".steps li").forEach((li,i) => {
    li.classList.toggle("done", i < forest.step);
    li.classList.toggle("now", i === forest.step);
  });
}
function nextExercise(talk) {
  forest.step++;
  forest.count = 0;
  player.action = null;
  bullets = [];
  if (forest.step === 2) player.ammo = FULL_AMMO;
  forestObjective();
  openTalk(talk);
}
function forestCanAttack(type) {
  if (forest.step === 0 || (forest.step === 1 && type === "shoot")) {
    say(forest.step === 0 ? "Primeiro, atravesse o riacho." : "Neste exercício, use o chicote.");
    return false;
  }
  if (forest.step === 2 && type === "shoot" && (player.x < 1194 || player.x > 1328)) {
    say("Fique na marca dourada para fazer o exercício de tiro.");
    return false;
  }
  return true;
}
function forestHit(target) {
  target.hit = true;
  forest.count++;
  forestObjective();
  burst(target.x,target.y,"#dbb476",16);
  burst(target.x,target.y,"#c7a35a",8,220,90);
  sfx(315,.13,1.35);
}
function forestWhip() {
  if (forest.step !== 1) return;
  for (const target of forest.targets) {
    const distance = (target.x-player.x)*player.face;
    if (target.type === "whip" && !target.hit && distance >= -7 && distance <= 117 &&
        range(player.y-36,target.y,25)) forestHit(target);
  }
}
function forestBullet(bullet,previousX) {
  if (forest.step !== 2) return;
  for (const target of forest.targets) {
    if (target.type === "shoot" && !target.hit && range(bullet.y,target.y,22) &&
        Math.min(previousX,bullet.x) <= target.x+13 && Math.max(previousX,bullet.x) >= target.x-13) {
      forestHit(target);
      bullet.t = 0;
      break;
    }
  }
}
function forestFall() {
  for (let i=0;i<3;i++) burst(player.x,forestGround+34,i ? "#9fd0d0" : "#e8f6f2",10,180,170);
  noise(.35, 700, .14);
  Object.assign(player,{x:forest.step ? 620 : 333,y:forestGround,vx:0,vy:0,ground:true,action:null,coyote:0,buffer:0});
  camera = clamp(player.x-W*.42,0,forestWidth-W);
  say("Splash. Tente de novo: segure a direção e pule antes da margem.");
}
function updateAmbient(dt) {
  const m = forest.mentor;
  const target = forest.step === 3 ? clamp(player.x - 70, 250, 1700) : mentorSpots[forest.step];
  const gap = target - m.x;
  m.moving = Math.abs(gap) > 3;
  if (m.moving) {
    m.face = Math.sign(gap);
    m.x += Math.sign(gap) * Math.min(Math.abs(gap), 96*dt);
    m.walk += 96*dt;
  } else m.face = player.x >= m.x ? 1 : -1;
  for (const t of forest.targets) if (t.hit) t.fall = Math.min(1, t.fall + dt*3.2);
  if (!leaves.length) leaves = Array.from({length:22}, (_,i) => newLeaf(i, true));
  for (const l of leaves) {
    l.t += dt;
    l.x += (l.vx + Math.sin(l.t*l.w)*22) * dt;
    l.y += l.vy * dt;
    if (l.y > forestGround + 6) Object.assign(l, newLeaf(l.i, false));
  }
}
function newLeaf(i, anywhere) {
  return {i, x:camera - 60 + Math.random()*(W+120), y:anywhere ? Math.random()*forestGround : -10 - Math.random()*60,
    vx:6 + Math.random()*14, vy:18 + Math.random()*20, w:1.5 + Math.random()*2, t:Math.random()*9,
    c:["#c9b45d","#9cae55","#d79a4a","#7f9a4d"][i%4]};
}
function forestIdle(dt) { if (dt) updateAmbient(dt); }
function forestTick(dt) {
  if (forest.step === 0 && player.x > 588 && player.ground) nextExercise("whip");
  else if (forest.step === 1 && forest.count >= 2) nextExercise("shot");
  else if (forest.step === 2 && forest.count >= 2) nextExercise("finish");
  updateAmbient(dt);
  const atCrate = forest.step === 2 && range(player.x,1237,58) && player.ground;
  el("prompt").hidden = !atCrate || !!forest.talk;
  if (atCrate) {
    el("prompt").textContent = "[E] Repor cartuchos";
    if (pressed.has("KeyE")) {
      player.ammo = FULL_AMMO;
      say("Cartuchos de treino repostos.");
      sfx(430,.16,1.3);
    }
  }
}

/* ---------- Desenho: utilitários ---------- */
function grain(x,y) {
  const raw = Math.sin(x*37.18+y*61.75)*43758.5453;
  return raw - Math.floor(raw);
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
function glow(target,x,y,r,rgb,opacity=.22) {
  const gradient = target.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,"rgba("+rgb+","+opacity+")");
  gradient.addColorStop(1,"rgba("+rgb+",0)");
  target.fillStyle = gradient; target.fillRect(x-r,y-r,r*2,r*2);
}
function marker(x,y,color,size=5) {
  polygon(ctx,[[x,y-size],[x+size,y],[x,y+size],[x-size,y]],color);
}
function layerCanvas(factor) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(W + (forestWidth - W) * factor) + 4; c.height = H;
  return c;
}
function blob(g,x,y,r,color) {
  g.fillStyle = color;
  for (let k=0;k<7;k++) {
    const a = k/7*Math.PI*2, rr = r*(.55+grain(x+k,y)*.35);
    g.beginPath(); g.arc(x+Math.cos(a)*r*.55, y+Math.sin(a)*r*.32, rr, 0, Math.PI*2); g.fill();
  }
}
function trunk(g,x,foot,w,lean,color,shade,top=-20) {
  polygon(g,[[x-w,foot],[x-w*.55,foot-40],[x-w*.4+lean,top],[x+w*.4+lean,top],[x+w*.55,foot-40],[x+w,foot]],color);
  polygon(g,[[x+w*.15,foot],[x+w*.2,foot-40],[x+w*.12+lean,top],[x+w*.4+lean,top],[x+w*.55,foot-40],[x+w,foot]],shade);
  polygon(g,[[x-w*1.8,foot],[x-w*.7,foot-16],[x-w*.4,foot]],color);
  polygon(g,[[x+w*.4,foot],[x+w*.8,foot-14],[x+w*1.9,foot]],shade);
}

/* ---------- Camadas pré-desenhadas ---------- */
function buildLayers() {
  const sky = document.createElement("canvas"); sky.width = W; sky.height = H;
  let g = sky.getContext("2d");
  let grad = g.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,"#163230"); grad.addColorStop(.38,"#4f7663"); grad.addColorStop(.66,"#d8cd92"); grad.addColorStop(.8,"#b9bd86"); grad.addColorStop(1,"#5f7c5c");
  g.fillStyle = grad; g.fillRect(0,0,W,H);
  glow(g,560,250,420,"255,236,170",.55);
  glow(g,560,250,140,"255,248,214",.6);

  // montanhas e árvores distantes
  const far = layerCanvas(.12); g = far.getContext("2d");
  for (let x=0;x<far.width;x+=6) {
    const h = 300 - Math.sin(x*.004)*34 - Math.sin(x*.011+1)*16 - grain(x,1)*6;
    g.fillStyle = "#8eaa8d"; g.fillRect(x,h,6,H-h);
  }
  for (let i=0;i<far.width/22;i++) {
    const x = i*22 + grain(i,2)*16, h = 70 + grain(i,3)*60;
    polygon(g,[[x-9,392],[x,392-h],[x+9,392]],"#7d9a80");
  }
  g.fillStyle = "#7d9a80"; g.fillRect(0,390,far.width,H-390);

  const back = layerCanvas(.32); g = back.getContext("2d");
  for (let i=-1;i<back.width/58+1;i++) {
    const x = i*58 + grain(i,5)*40, w = 7 + grain(i,6)*8;
    trunk(g,x,430,w,(grain(i,7)-.5)*30,"#668a75","#5b7d6a",0);
    blob(g,x+(grain(i,8)-.5)*30,40+grain(i,9)*70,42+grain(i,4)*30,"#56786590");
  }
  for (let i=0;i<back.width/40;i++) blob(g,i*40,10+grain(i,10)*30,46,"#47695a");
  g.fillStyle = "#5e8170"; g.fillRect(0,428,back.width,H-428);

  const mid = layerCanvas(.58); g = mid.getContext("2d");
  for (let i=-1;i<mid.width/96+1;i++) {
    const x = i*96 + grain(i,11)*60, w = 12 + grain(i,12)*12;
    trunk(g,x,446,w,(grain(i,13)-.5)*40,"#3f6152","#355446",-10);
    for (let k=0;k<3;k++) {
      const by = 120 + k*70 + grain(i,k)*40, dir = k%2 ? 1 : -1;
      line(g,[[x,by+30],[x+dir*40,by+6],[x+dir*86,by-14]],"#3a5a4c",4);
      blob(g,x+dir*82,by-18,22,"#3c5f4f");
    }
  }
  for (let i=0;i<mid.width/50;i++) blob(g,i*50+grain(i,14)*20,grain(i,15)*50,58,i%2 ? "#2f5043" : "#365a4b");

  const near = layerCanvas(.86); g = near.getContext("2d");
  for (let i=-1;i<near.width/170+1;i++) {
    const x = i*170 + grain(i,21)*90, w = 20 + grain(i,22)*18;
    trunk(g,x,452,w,(grain(i,23)-.5)*30,"#24403a","#1b322e",-30);
    for (let y=60;y<430;y+=26) {
      if (grain(i,y) > .55) { g.fillStyle = "#4f7a4f"; g.fillRect(x-w*.5+grain(y,i)*w*.3,y,3,8+grain(i,y+1)*10); }
    }
    for (let v=0;v<3;v++) {
      const vx = x + (v-1)*w*1.6 + 30, len = 90 + grain(i,v)*150;
      line(g,[[vx,0],[vx+4,len*.5],[vx-2,len]],"#2b4a36",2);
      for (let y=10;y<len;y+=14) polygon(g,[[vx,y],[vx+7,y+3],[vx+1,y+7]],"#3f6a44");
    }
  }
  for (let i=0;i<near.width/34;i++) blob(g,i*34,-6+grain(i,25)*26,40,i%3 ? "#1e3a31" : "#25443a");

  // chão do mundo
  const ground = document.createElement("canvas"); ground.width = forestWidth; ground.height = H;
  g = ground.getContext("2d");
  // leito do riacho
  g.fillStyle = "#1c3434"; g.fillRect(STREAM.from,forestGround+10,STREAM.to-STREAM.from,H);
  for (const {x,w,y} of forestPlatforms) {
    grad = g.createLinearGradient(0,y,0,H);
    grad.addColorStop(0,"#4b5634"); grad.addColorStop(.12,"#3b3a29"); grad.addColorStop(.5,"#2d2a22"); grad.addColorStop(1,"#1d1b17");
    g.fillStyle = grad; g.fillRect(x,y,w,H-y);
    for (let i=x;i<x+w;i+=3) {
      const c = grain(i,31);
      g.fillStyle = c>.5 ? "#6f8b46" : "#5a7539"; g.fillRect(i,y,3,4+Math.floor(c*4));
      g.fillStyle = "#88a556"; if (c>.7) g.fillRect(i,y,3,2);
    }
    for (let n=0;n<w/9;n++) {
      const sx = x + grain(n,x)*w, sy = y + 20 + grain(n,y+3)*(H-y-24), r = 2 + grain(n,7)*5;
      g.fillStyle = grain(n,9) > .5 ? "#4a4436" : "#3a352b";
      g.beginPath(); g.ellipse(sx,sy,r*1.4,r,0,0,Math.PI*2); g.fill();
      g.fillStyle = "#5d5644"; g.fillRect(sx-r*.6,sy-r*.7,r*.8,1);
    }
    for (let n=0;n<w/60;n++) {
      const rx = x + grain(n,41)*w, ry = y + 14 + grain(n,42)*30;
      line(g,[[rx,ry],[rx+12,ry+8],[rx+30,ry+6],[rx+44,ry+16]],"#2a2219",3);
    }
  }
  // margens com pedras
  for (const bank of [STREAM.from, STREAM.to]) {
    for (let k=0;k<6;k++) {
      const bx = bank + (bank === STREAM.from ? -k*7 : k*7), by = forestGround + 6 + k*9;
      g.fillStyle = k%2 ? "#5c6458" : "#717a6b";
      g.beginPath(); g.ellipse(bx,by,9,6,0,0,Math.PI*2); g.fill();
      g.fillStyle = "#8f9984"; g.fillRect(bx-4,by-5,6,1);
    }
  }
  // flores, cogumelos e um tronco caído
  for (let n=0;n<70;n++) {
    const fx = grain(n,51)*forestWidth;
    if (fx > STREAM.from-12 && fx < STREAM.to+12) continue;
    const kind = n%5;
    if (kind < 3) {
      g.fillStyle = "#42633a"; g.fillRect(fx,forestGround-6,1,6);
      g.fillStyle = ["#f1ecd6","#e8c95b","#c9a3d8"][kind]; g.fillRect(fx-1,forestGround-8,3,3);
      g.fillStyle = "#fff6c8"; g.fillRect(fx,forestGround-7,1,1);
    } else if (kind === 3) {
      g.fillStyle = "#e3d6bb"; g.fillRect(fx,forestGround-5,2,5);
      g.fillStyle = "#b5523b"; g.fillRect(fx-3,forestGround-8,8,3);
      g.fillStyle = "#f2e2c8"; g.fillRect(fx-1,forestGround-8,1,1);
    }
  }
  polygon(g,[[300,forestGround],[304,forestGround-13],[392,forestGround-15],[398,forestGround-2],[396,forestGround]],"#4b3a2b");
  g.fillStyle = "#6a523b"; g.fillRect(304,forestGround-14,88,3);
  g.fillStyle = "#3c6b3d"; g.fillRect(320,forestGround-16,30,3);
  g.fillStyle = "#2f2419"; g.beginPath(); g.ellipse(395,forestGround-8,5,7,0,0,Math.PI*2); g.fill();
  g.fillStyle = "#8a6d4c"; g.beginPath(); g.ellipse(395,forestGround-8,3,5,0,0,Math.PI*2); g.fill();

  // primeiro plano
  const front = layerCanvas(1.22); g = front.getContext("2d");
  for (let i=0;i<front.width/260;i++) {
    const x = i*260 + grain(i,61)*140;
    for (let f=0;f<9;f++) {
      const a = -Math.PI*.95 + f*.12 + grain(i,f)*.1, len = 70 + grain(f,i)*60;
      const ex = x + Math.cos(a)*len, ey = H + 6 + Math.sin(a)*len;
      line(g,[[x,H+8],[ (x+ex)/2, (H+ey)/2 - 10 ],[ex,ey]],"#0b1714",5);
      for (let s=.3;s<1;s+=.12) {
        const px = x + (ex-x)*s, py = H+8 + (ey-H-8)*s - 10*Math.sin(s*Math.PI);
        polygon(g,[[px,py],[px+9,py-5],[px+3,py+4]],"#0d1c18");
        polygon(g,[[px,py],[px-8,py-6],[px-2,py+4]],"#0f201b");
      }
    }
  }
  layers = {sky, far, back, mid, near, ground, front};
}

/* ---------- Desenho por quadro ---------- */
function drawLayer(image, factor, offset) {
  ctx.drawImage(image, Math.round(offset - offset*factor), 0);
}
function drawShafts(t, offset) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [sx, f] of [[340,.5],[820,.62],[1180,.55],[1560,.6]]) {
    const x = sx - offset*f + offset;
    const a = .05 + Math.sin(t*.7 + sx)*.025;
    const grad = ctx.createLinearGradient(x,40,x+170,forestGround);
    grad.addColorStop(0,"rgba(255,240,180,"+(a*1.6)+")");
    grad.addColorStop(1,"rgba(255,240,180,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(x,30); ctx.lineTo(x+46,30); ctx.lineTo(x+250,forestGround); ctx.lineTo(x+110,forestGround); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawMist(t, offset) {
  for (let k=0;k<3;k++) {
    const y = 360 + k*26, drift = (t*(6+k*4) + k*300) % 400;
    for (let x = -400 + offset - (offset*.3 % 400) + drift; x < offset + W + 400; x += 400) {
      const grad = ctx.createRadialGradient(x+200,y,10,x+200,y,220);
      grad.addColorStop(0,"rgba(226,236,214,"+(.09-k*.02)+")");
      grad.addColorStop(1,"rgba(226,236,214,0)");
      ctx.fillStyle = grad; ctx.fillRect(x-30,y-60,460,120);
    }
  }
}
function drawWater(t) {
  const {from,to} = STREAM, top = forestGround + 22;
  const grad = ctx.createLinearGradient(0,top,0,H);
  grad.addColorStop(0,"#5f9a95"); grad.addColorStop(.3,"#2f625f"); grad.addColorStop(1,"#173a3a");
  ctx.fillStyle = grad; ctx.fillRect(from,top,to-from,H-top);
  for (let i=0;i<14;i++) {
    const y = top + 4 + (i%5)*14, x = from + ((i*29 + t*(18+i%3*9)) % (to-from+30)) - 15;
    ctx.fillStyle = i%3 ? "#a8d4cc88" : "#e6fff7aa";
    ctx.fillRect(Math.floor(x), Math.floor(y + Math.sin(t*3+i)*1.5), 10 + i%3*5, 1);
  }
  ctx.fillStyle = "#d9f2ea55"; ctx.fillRect(from, top, to-from, 2);
}
function drawGrass(t, offset) {
  const start = Math.max(0, Math.floor((offset-20)/7)*7), end = Math.min(forestWidth, offset+W+20);
  for (let x=start; x<end; x+=7) {
    if (x > STREAM.from-4 && x < STREAM.to+4) continue;
    const h = 5 + grain(x,77)*9, near = Math.abs(player.x - x) < 26 && player.ground ? (x - player.x)*.25 : 0;
    const sway = Math.sin(t*1.8 + x*.05)*2 + near;
    line(ctx,[[x,forestGround+1],[x+sway*.5,forestGround-h*.5],[x+sway,forestGround-h]], grain(x,78) > .5 ? "#7f9d4b" : "#5f7d3c", 2);
  }
}
function drawProps(t) {
  for (const x of [418,583,1166,1359,1725]) {
    ctx.fillStyle="#3a2e25"; ctx.fillRect(x-3,398,6,46);
    ctx.fillStyle="#6e5a40"; ctx.fillRect(x-8,401,16,6);
    ctx.fillStyle="#9c8358"; ctx.fillRect(x-8,400,16,2);
    ctx.fillStyle="#2a3a2a"; ctx.fillRect(x-3,420,6,3);
  }
  // marca de tiro e caixa de cartuchos
  const active = forest.step === 2;
  ctx.fillStyle = active ? "#e2bd6c" : "#8d7a52"; ctx.fillRect(1212,forestGround-1,100,3);
  if (active) glow(ctx,1262,forestGround,60,"240,200,110",.18);
  ctx.fillStyle="#3e3022"; ctx.fillRect(1221,421,32,23);
  ctx.fillStyle="#6e553a"; ctx.fillRect(1221,421,32,5);
  ctx.fillStyle="#5a4530"; ctx.fillRect(1223,428,28,2); ctx.fillRect(1223,435,28,2);
  ctx.fillStyle="#d3b176"; ctx.fillRect(1233,430,8,7);
  ctx.fillStyle="#3e3022"; ctx.fillRect(1236,432,2,3);
  // bandeirinha da Ordem
  ctx.fillStyle="#3a2e25"; ctx.fillRect(1318,392,3,52);
  const wave = Math.sin(t*3)*2;
  polygon(ctx,[[1321,393],[1345,396+wave],[1340,404+wave],[1345,412+wave],[1321,409]],"#7d1e18");
  ctx.fillStyle="#e3c47c"; ctx.fillRect(1329,399+wave/2,2,8); ctx.fillRect(1326,402+wave/2,8,2);
}
function drawTargets(t) {
  for (const target of forest.targets) {
    const {x,y,type,hit,fall} = target;
    const active = forest.step === (type==="whip" ? 1 : 2) && !hit;
    if (type === "whip") {
      ctx.fillStyle="#4c3b28"; ctx.fillRect(x-15,y-66,6,110);
      ctx.fillStyle="#6b5338"; ctx.fillRect(x-15,y-66,2,110);
      ctx.fillStyle="#4c3b28"; ctx.fillRect(x-15,y-66,36,5);
      line(ctx,[[x-12,y-50],[x-2,y-62]],"#4c3b28",3);
      const swing = hit ? 0 : Math.sin(t*1.6 + x)*.08;
      if (!hit) {
        ctx.save(); ctx.translate(x,y-61); ctx.rotate(swing);
        line(ctx,[[0,0],[0,47]],"#b39b62",2);
        drawSack(0,61,active,t);
        ctx.restore();
      } else {
        line(ctx,[[x,y-61],[x+Math.sin(t*4)*2,y-50]],"#b39b62",2);
        const fy = y + (forestGround - 10 - y) * (fall*fall);
        ctx.save(); ctx.translate(x+6*fall, fy); ctx.rotate(fall*1.35);
        drawSack(0,0,false,t,true);
        ctx.restore();
      }
    } else {
      ctx.fillStyle="#4c3b28"; ctx.fillRect(x-2,y+6,5,forestGround-y-6);
      ctx.fillStyle="#4c3b28"; ctx.fillRect(x-10,forestGround-4,21,4);
      ctx.save(); ctx.translate(x,y);
      ctx.rotate(hit ? -fall*.5 : 0);
      ctx.scale(hit ? 1 - fall*.35 : 1, 1);
      const rings = ["#e8dcc0","#9b2a20","#e8dcc0","#9b2a20"];
      rings.forEach((c,i) => { ctx.fillStyle = hit ? "#6e6450" : c; ctx.beginPath(); ctx.arc(0,0,15-i*3.6,0,Math.PI*2); ctx.fill(); });
      ctx.strokeStyle="#3b2c1c"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.stroke();
      if (hit) { ctx.fillStyle="#1d150d"; ctx.fillRect(-2,-2,4,4); }
      ctx.restore();
    }
    if (active) {
      glow(ctx,x,y,34,"237,190,104",.24);
      marker(x,y-36+Math.sin(t*3+x)*3,"#e6bb79",4);
    }
  }
}
function drawSack(cx,cy,active,t,fallen=false) {
  const body = active ? "#c9a663" : "#a98a52";
  polygon(ctx,[[cx-10,cy-14],[cx+10,cy-14],[cx+14,cy-4],[cx+13,cy+10],[cx+8,cy+15],[cx-8,cy+15],[cx-13,cy+10],[cx-14,cy-4]],body);
  ctx.fillStyle = fallen ? "#7b6440" : "#8a6f43";
  ctx.fillRect(cx-14,cy+2,28,2); ctx.fillRect(cx-6,cy-14,2,29);
  ctx.fillStyle = "#e4cf8f"; ctx.fillRect(cx-9,cy-12,6,2);
  for (let k=0;k<5;k++) line(ctx,[[cx-8+k*4,cy+15],[cx-9+k*4+Math.sin(t*2+k)*1,cy+20]],"#d8bf78",1);
  ctx.fillStyle="#b39b62"; ctx.fillRect(cx-4,cy-17,8,4);
}
function drawMentor(t) {
  const m = forest.mentor;
  const step = m.moving ? Math.sin(m.walk*.16) : 0;
  const bob = m.moving ? Math.abs(step)*-1.5 : Math.sin(t*1.6)*.6;
  ctx.save();
  ctx.translate(Math.round(m.x), forestGround);
  ctx.scale(m.face,1);
  const R = (x,y,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(x,Math.round(y+bob),w,h); };
  ctx.fillStyle="#0f1d1aa0"; ctx.beginPath(); ctx.ellipse(0,-1,22,3,0,0,Math.PI*2); ctx.fill();
  // botas
  R(-9+step*4,-6,9,6,"#0c0c0e"); R(1-step*4,-6,10,6,"#111114");
  // batina
  ctx.save(); ctx.translate(0,bob);
  polygon(ctx,[[-13,-72],[13,-72],[17,-38],[19,-6],[-19,-6],[-16,-38]],"#17181c");
  polygon(ctx,[[3,-72],[13,-72],[17,-38],[19,-6],[6,-6],[5,-38]],"#1f2026");
  ctx.fillStyle="#2b2c33"; ctx.fillRect(-19,-8,38,2);
  // faixa na cintura
  ctx.fillStyle="#0e0f12"; ctx.fillRect(-15,-44,30,5);
  // chicote enrolado e coldre
  ctx.strokeStyle="#6a4a2c"; ctx.lineWidth=2;
  for (let k=0;k<3;k++) { ctx.beginPath(); ctx.ellipse(-15,-36,5-k,6-k,0,0,Math.PI*2); ctx.stroke(); }
  ctx.fillStyle="#26201c"; ctx.fillRect(12,-42,6,11);
  ctx.fillStyle="#8b7a5c"; ctx.fillRect(13,-44,4,3);
  // botões
  ctx.fillStyle="#34353d"; for (let y=-66;y<-46;y+=5) ctx.fillRect(7,y,2,2);
  // capa (mozeta)
  polygon(ctx,[[-17,-74],[-6,-79],[8,-79],[18,-73],[21,-56],[14,-52],[-14,-52],[-21,-57]],"#1c1d22");
  polygon(ctx,[[2,-79],[8,-79],[18,-73],[21,-56],[14,-52],[4,-53]],"#25262d");
  line(ctx,[[-17,-73],[-6,-78],[8,-78]],"#3a3c45",1);
  // cruz dourada
  line(ctx,[[0,-77],[5,-64]],"#b8954a",1);
  ctx.fillStyle="#e2c06b"; ctx.fillRect(4,-64,2,8); ctx.fillRect(2,-62,6,2);
  // braço com o livro
  if (m.moving) {
    polygon(ctx,[[-14,-70],[-8,-70],[-6+step*5,-46],[-12+step*5,-46]],"#141519");
    R(-12+step*5,-48-bob,5,4,"#d7b3a3");
  } else {
    polygon(ctx,[[10,-70],[17,-68],[19,-48],[12,-48]],"#141519");
    ctx.fillStyle="#4a3a36"; ctx.fillRect(13,-58,9,14);
    ctx.fillStyle="#56665a"; ctx.fillRect(20,-58,3,14);
    ctx.fillStyle="#d7b3a3"; ctx.fillRect(14,-50,6,4);
  }
  // pescoço, colarinho
  ctx.fillStyle="#111216"; ctx.fillRect(-4,-83,10,6);
  ctx.fillStyle="#ece8dc"; ctx.fillRect(3,-82,3,3);
  // cabeça
  ctx.fillStyle="#d2a493"; ctx.fillRect(-5,-99,13,15);
  ctx.fillStyle="#b7867a"; ctx.fillRect(-5,-99,4,15);
  ctx.fillStyle="#9b5b4b"; ctx.fillRect(4,-95,3,3); // queimadura perto do olho
  ctx.fillStyle="#e9eef0"; ctx.fillRect(5,-94,2,1);
  ctx.fillStyle="#2a2b2f"; ctx.fillRect(3,-96,5,1); // sobrancelha
  // barba e bigode
  polygon(ctx,[[-5,-90],[-3,-84],[0,-78],[5,-75],[9,-79],[9,-86],[6,-88],[1,-86]],"#38393e");
  ctx.fillStyle="#4a4b50"; ctx.fillRect(3,-88,7,2);
  ctx.fillStyle="#2a2b2f"; ctx.fillRect(1,-80,5,2);
  // cabelo grisalho
  polygon(ctx,[[-7,-97],[-6,-103],[0,-106],[7,-105],[10,-101],[8,-98],[2,-100],[-2,-98],[-4,-90],[-7,-91]],"#3b3c40");
  polygon(ctx,[[1,-105],[7,-106],[10,-102],[6,-100],[3,-101]],"#b8bcc1");
  ctx.fillStyle="#8f9399"; ctx.fillRect(-6,-95,2,6);
  ctx.restore();
  ctx.restore();
}
function drawChild(t) {
  const p=player;
  let frame=0;
  if (p.action === "whip") frame=p.actionTime < .112 ? 8 : 9;
  else if (p.action === "shoot") frame=p.actionTime >= .12 && p.actionTime < .21 ? 11 : 10;
  else if (!p.ground) frame=p.vy < -160 ? 4 : p.vy < 92 ? 5 : 6;
  else if (p.landing > .06) frame=7;
  else if (Math.abs(p.vx) > 16) frame=[1,2,3,2][Math.floor(p.walk/15)%4];
  ctx.save();
  ctx.translate(Math.round(p.x),Math.round(p.y));
  ctx.scale(p.face,1);
  if (p.ground) { ctx.fillStyle="#0f1d1aa0"; ctx.beginPath(); ctx.ellipse(0,-1,15,3,0,0,Math.PI*2); ctx.fill(); }
  if (childAtlas.complete && childAtlas.naturalWidth) {
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(childAtlas,(frame%4)*88,Math.floor(frame/4)*74,88,74,-50,-65,88,74);
  } else polygon(ctx,[[-12,0],[-8,-48],[0,-58],[11,-46],[10,0]],"#748a91");
  if (p.action === "shoot") {
    const grip=frame===11 ? -42 : -41;
    line(ctx,[[17,grip],[26,grip],[58,-42]],"#29272e",6);
    line(ctx,[[22,grip],[58,-42]],"#cebcad",2.5);
    line(ctx,[[26,grip-8],[26,grip+8]],"#e4ccaa",3);
    if (frame===11 && p.actionTime < .17) {
      glow(ctx,59,-42,29,"253,175,98",.42);
      polygon(ctx,[[58,-42],[66,-48],[79,-42],[66,-37]],"#ffd49c");
    }
  }
  ctx.restore();
}
function drawForest(t,offset) {
  if (!layers) buildLayers();
  ctx.drawImage(layers.sky, offset, 0);
  drawLayer(layers.far,.12,offset);
  drawLayer(layers.back,.32,offset);
  drawMist(t,offset);
  drawLayer(layers.mid,.58,offset);
  drawShafts(t,offset);
  drawLayer(layers.near,.86,offset);
  ctx.drawImage(layers.ground,0,0);
  drawWater(t);
  drawProps(t);
  drawTargets(t);
  drawMentor(t);
  drawGrass(t,offset);
}
function drawForeground(t,offset) {
  for (const l of leaves) {
    ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(Math.sin(l.t*l.w)*1.2);
    ctx.fillStyle = l.c; ctx.fillRect(-3,-1,6,3); ctx.fillStyle = "#00000033"; ctx.fillRect(-3,1,6,1);
    ctx.restore();
  }
  for (let i=0;i<34;i++) {
    const x = (grain(i,22)*forestWidth + t*(5+grain(i,20)*11)) % forestWidth;
    const y = 150 + grain(i,25)*270 + Math.sin(i+t*.85)*10;
    const blink = .5 + Math.sin(t*2+i)*.5;
    ctx.globalAlpha = .35 + blink*.65;
    ctx.fillStyle = i%5 ? "#f3eab0" : "#fff6c4";
    ctx.fillRect(Math.floor(x),Math.floor(y),2,2);
  }
  ctx.globalAlpha = 1;
  drawLayer(layers.front,1.22,offset);
}
let vignette;
function drawGrade(t) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const warm = ctx.createLinearGradient(0,0,W,H);
  warm.addColorStop(0,"rgba(255,214,140,.35)"); warm.addColorStop(1,"rgba(40,70,60,.25)");
  ctx.fillStyle = warm; ctx.fillRect(0,0,W,H);
  ctx.restore();
  if (!vignette) {
    vignette = ctx.createRadialGradient(W*.5,H*.45,200,W*.5,H*.5,600);
    vignette.addColorStop(0,"rgba(8,14,12,0)"); vignette.addColorStop(1,"rgba(8,14,12,.62)");
  }
  ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);
}
