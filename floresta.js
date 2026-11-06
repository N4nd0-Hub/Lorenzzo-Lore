"use strict";

const forestWidth = 1880;
const forestGround = 444;
const forestPlatforms = [
  {x:0,w:450,y:forestGround}, {x:565,w:forestWidth-565,y:forestGround}
];
const exercises = [
  {label:"Travessia", title:"Atravesse o riacho", text:"Siga para a direita com A/D ou as setas. Pule com Espaço antes da margem."},
  {label:"Chicote", title:"Acerte os alvos de corda", text:"Aproxime-se dos dois alvos de palha e use J para cortar a corda."},
  {label:"Pistola-cruz", title:"Acerte os alvos de longe", text:"Pare junto à marca no chão e use K. A caixa ao lado repõe os cartuchos."},
  {label:"Concluído", title:"Treino concluído", text:"Você atravessou o riacho e completou os dois exercícios de combate."}
];
const talks = {
  opening:[
    ["mentor","Antes de pegar no chicote, quero que entenda por que a Ordem caça, Lourenzzo."],
    ["mentor","O mar é nosso Deus. Há poderes que mal compreendemos, e há quem os use para pôr a vontade dos outros debaixo da sua."],
    ["mentor","Quando alguém toma esse poder para si e o usa contra os outros, é como tirar algo de Deus sem pedir. É esse abuso que juramos impedir."],
    ["lourenzzo","E como eu vou saber quando alguém está abusando?"],
    ["mentor","Ouvindo quem sofreu as consequências. A arma vem depois. Agora atravesse o riacho. Eu quero ver como você salta."]
  ],
  whip:[
    ["mentor","Muito bem. Pendurei dois alvos de palha na trilha. Chegue perto e corte as cordas com o chicote."],
    ["lourenzzo","Os dois? O segundo está bem mais longe."],
    ["mentor","Então caminhe até ele. Aprenda a medir a distância antes de estalar o braço."]
  ],
  shot:[
    ["mentor","Agora a pistola-cruz. Segure pelo centro. A ponta de baixo da cruz fica voltada para o alvo."],
    ["mentor","Fique na marca no chão. Inspire, firme as mãos e só então aperte o gatilho. Tem mais cartuchos na caixa."]
  ],
  finish:[
    ["lourenzzo","Acertei os dois, mestre."],
    ["mentor","Acertou. Agora guarde a arma. Quem aprende a usar força precisa aprender a hora de baixar a mão também."]
  ]
};
const childAtlas = new Image();
childAtlas.src = "lourenzzo-seminarista.png";
let forest = null;
let forestBack;

function setChapter(isForest) {
  el("chapter-title").textContent = isForest ? "O Treino na Floresta" : "A Capela do Sino Mudo";
  el("chapter-tag").firstChild.textContent = isForest ? "PRÓLOGO " : "ATO I ";
  el("chapter-place").textContent = isForest ? "WEST BLUE" : "AS RUÍNAS";
  el("play").classList.toggle("forest", isForest);
  el("map-marker").parentElement.hidden = isForest;
  el("training-step").hidden = !isForest;
  el("dash-guide").hidden = isForest;
  el("field-note").textContent = isForest
    ? "Floresta do West Blue · Anos antes da campanha."
    : "O chicote poupa munição. Santuários recuperam vida e cartuchos.";
}
function clearTalk() {
  el("dialogue").hidden = true;
  el("frame-content").inert = false;
  el("touch-controls").inert = false;
  el("pause").disabled = mode !== "playing" && mode !== "paused";
}
function selectForest(showIntro) {
  forest = {
    step:0, talk:null, index:0, count:0,
    targets:[
      {x:818,y:405,type:"whip",hit:false},
      {x:1018,y:405,type:"whip",hit:false},
      {x:1430,y:414,type:"shoot",hit:false},
      {x:1638,y:414,type:"shoot",hit:false}
    ]
  };
  setChapter(true);
  spawn();
  if (!showIntro) return;
  setMode("playing");
  openTalk("opening");
}
function showTalk() {
  const [speaker,line] = forest.talk[forest.index];
  const last = forest.index === forest.talk.length-1;
  const box = el("dialogue");
  box.dataset.speaker = speaker;
  el("speaker").textContent = speaker === "mentor" ? "Mestre da Ordem" : "Lourenzzo";
  el("dialogue-line").textContent = line;
  el("dialogue-count").textContent = (forest.index+1)+" / "+forest.talk.length;
  el("dialogue-next").textContent = last ? (forest.step === 3 ? "Ir à capela →" : "Começar exercício →") : "Continuar →";
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
  forest.index++;
  if (forest.index < forest.talk.length) {
    showTalk();
    return;
  }
  forest.talk = null;
  clearTalk();
  if (forest.step === 3) newRun();
  else canvas.focus({preventScroll:true});
}
function forestObjective() {
  const exercise = exercises[forest.step];
  el("objective-title").textContent = exercise.title;
  el("objective-text").textContent = exercise.text;
  const done = forest.step === 1 || forest.step === 2 ? " · "+forest.count+"/2 alvos" : "";
  el("training-step").textContent = exercise.label + done;
  el("location").textContent = forest.step < 2 ? "Trilha da Ordem" : "Clareira de tiro";
  el("checkpoint").textContent = forest.step === 3 ? "Treino concluído" : "Exercício "+(forest.step+1)+" de 3";
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
  burst(target.x,target.y,"#dbb476",14);
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
  Object.assign(player,{x:forest.step ? 620 : 333,y:forestGround,vx:0,vy:0,ground:true,action:null,coyote:0,buffer:0});
  camera = clamp(player.x-W*.42,0,forestWidth-W);
  say("Tente de novo. Segure a direção e pule antes da margem.");
}
function forestTick() {
  if (forest.step === 0 && player.x > 588 && player.ground) nextExercise("whip");
  else if (forest.step === 1 && forest.count >= 2) nextExercise("shot");
  else if (forest.step === 2 && forest.count >= 2) nextExercise("finish");
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

function makeForest() {
  const image = document.createElement("canvas");
  image.width = forestWidth; image.height = H;
  const g = image.getContext("2d");
  const sky = g.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,"#102529");
  sky.addColorStop(.54,"#557a69");
  sky.addColorStop(.82,"#9a9973");
  sky.addColorStop(1,"#2d5143");
  g.fillStyle=sky; g.fillRect(0,0,forestWidth,H);
  for (const x of [350,1050,1510]) glow(g,x,223,330,"226,208,144",.42);
  for (let layer=0; layer<3; layer++) {
    const spacing=[48,69,125][layer];
    for (let i=-1; i<forestWidth/spacing+1; i++) {
      const x=i*spacing+Math.round(grain(i,layer+2)*spacing*.83);
      const w=[8,14,30][layer]+grain(i,layer)*[13,22,42][layer];
      const bend=(grain(i+39,layer)-.5)*84;
      const foot=449+layer*9-grain(i,8)*29;
      const color=["#4c6b5d","#33594d","#233e38"][layer];
      polygon(g,[[x-w,foot],[x-w*.41,222],[x+bend-w*.39,-15],[x+bend+w*.48,-15],
        [x+w*.26,196],[x+w*.44,foot-11],[x+w,foot]],color);
      const branch=80+grain(i+8,layer)*172;
      polygon(g,[[x,branch+44],[x-38,branch+4],[x-79,branch-14],[x-42,branch-12],[x-13,branch+13],[x+11,branch+24]],color);
      polygon(g,[[x-2,branch+39],[x+41,branch-5],[x+90,branch-36],[x+55,branch-7],[x+31,branch+25],[x+6,branch+60]],color);
      if (layer===2) {
        line(g,[[x-w*.55,foot-10],[x-w*.18,218],[x+bend-w*.22,0]],"#52705b8a",3);
        for (let j=0;j<10;j++) {
          const y=57+j*38+Math.round(grain(i,j)*16);
          g.fillStyle=j%2 ? "#34554b" : "#192f2d";
          g.fillRect(x+Math.round((grain(j,i)-.5)*w*.62),y,3,10+Math.round(grain(i,j+2)*23));
        }
      }
    }
  }
  for (let i=0;i<170;i++) {
    const x=grain(i,11)*forestWidth, y=grain(i,12)*154;
    const w=36+grain(i,13)*112, h=12+grain(i,14)*22;
    polygon(g,[[x-w,y],[x-w*.65,y-h],[x+w*.4,y-h*.8],[x+w,y+4],[x+w*.53,y+h],
      [x-w*.36,y+h]],["#213e35","#284738","#315043","#355347"][i%4]);
  }
  for (const x of [350,1040,1470]) {
    polygon(g,[[x,57],[x+63,69],[x+253,443],[x+124,443]],"#efdf9920");
    polygon(g,[[x+43,79],[x+61,88],[x+214,443],[x+174,443]],"#eee4b216");
  }
  for (let i=0;i<125;i++) {
    const x=Math.round(grain(i,14)*forestWidth), y=418+Math.round(grain(i,17)*31);
    const h=7+grain(i,15)*28;
    polygon(g,[[x-7,y],[x-13,y-h*.65],[x-2,y-h*.46],[x,y-h],[x+3,y-h*.42],[x+13,y-h*.72],[x+8,y]],i%3 ? "#344f3d" : "#233d34");
  }
  return image;
}
function drawForest(t,offset) {
  forestBack ??= makeForest();
  ctx.drawImage(forestBack,0,0);
  ctx.fillStyle="#1b393b"; ctx.fillRect(450,473,115,67);
  for (let i=0;i<7;i++) {
    const x=454+(i*18+t*14)%92;
    ctx.fillStyle=i%2 ? "#6d9587" : "#45685f";
    ctx.fillRect(Math.floor(x),481+(i%3)*13,16,2);
  }
  for (const {x,w,y} of forestPlatforms) {
    ctx.fillStyle="#2b3530"; ctx.fillRect(x,y,w,H-y);
    ctx.fillStyle="#76905a"; ctx.fillRect(x,y,w,3);
    ctx.fillStyle="#465c43"; ctx.fillRect(x,y+3,w,8);
    for(let i=Math.max(x,Math.floor(offset/17)*17-17);i<Math.min(x+w,offset+W+18);i+=17) {
      const c=grain(i,31);
      ctx.fillStyle=c>.52 ? "#566447" : "#354338";
      ctx.fillRect(i,y+9,10,3+Math.floor(c*5));
      ctx.fillStyle="#222d2a";
      ctx.fillRect(i+5,y+25+Math.floor(c*47),8,2);
      if (c>.64) line(ctx,[[i,y],[i-1,y-8],[i+4,y-4]],"#8d9b66");
    }
  }
  for (const x of [418,583,1166,1359,1725]) {
    const wood=["#352d28","#6e6044","#ad9760"];
    ctx.fillStyle=wood[0]; ctx.fillRect(x-3,397,6,47);
    ctx.fillStyle=wood[1]; ctx.fillRect(x-8,401,16,7);
    ctx.fillStyle=wood[2]; ctx.fillRect(x-8,400,16,2);
  }
  drawForestMentor(243,forestGround);
  ctx.fillStyle="#9c8860"; ctx.fillRect(1212,442,100,2);
  ctx.fillStyle="#494436"; ctx.fillRect(1223,423,28,21);
  ctx.fillStyle="#827353"; ctx.fillRect(1223,423,28,4);
  ctx.fillStyle="#d3b176"; ctx.fillRect(1234,430,5,6);
  for(const target of forest.targets) {
    const {x,y,type,hit}=target;
    const active=forest.step === (type==="whip" ? 1 : 2) && !hit;
    if (type==="whip") {
      ctx.fillStyle="#574d37"; ctx.fillRect(x-13,y-63,5,105); ctx.fillRect(x-11,y-63,29,5);
      line(ctx,[[x,y-59],[x,y-(hit ? 38 : 14)]],"#a6915a",2);
    } else {
      ctx.fillStyle="#5c4f39"; ctx.fillRect(x-2,y,5,30);
    }
    const faceY=hit && type==="whip" ? 433 : y;
    if(active) {
      glow(ctx,x,faceY,32,"237,190,104",.26);
      marker(x,faceY-29+Math.sin(t*3+x)*3,"#e6bb79",4);
    }
    const fill=hit ? "#514a38" : active ? "#ad8b57" : "#75694b";
    polygon(ctx,[[x-11,faceY-13],[x+10,faceY-13],[x+16,faceY-6],[x+16,faceY+8],
      [x+9,faceY+13],[x-10,faceY+13],[x-16,faceY+6],[x-16,faceY-6]],fill);
    marker(x,faceY,hit ? "#727356" : "#704a40",8);
    marker(x,faceY,hit ? "#a5ba83" : "#dfb779",3);
  }
  for(let i=0;i<42;i++) {
    const x=(grain(i,22)*forestWidth+t*(5+grain(i,20)*11))%forestWidth;
    const y=145+grain(i,25)*278+Math.sin(i+t*.85)*10;
    ctx.fillStyle=i%6 ? "#e1db9e77" : "#fff0aa";
    ctx.fillRect(Math.floor(x),Math.floor(y),2,2);
  }
}
function drawForestMentor(x,y) {
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="#152525"; ctx.fillRect(-18,-5,39,5);
  polygon(ctx,[[-20,-72],[-25,-41],[-19,-5],[21,-5],[25,-41],[17,-72]],"#29252b");
  polygon(ctx,[[-17,-70],[-19,-30],[-13,-9],[-6,-9],[-5,-71]],"#446154");
  polygon(ctx,[[17,-70],[18,-29],[13,-9],[6,-9],[5,-71]],"#446154");
  polygon(ctx,[[-12,-92],[-7,-100],[7,-99],[14,-89],[11,-74],[-8,-74]],"#8f6854");
  polygon(ctx,[[-13,-93],[-7,-103],[7,-101],[14,-95],[13,-90],[7,-93],[-8,-90]],"#474140");
  polygon(ctx,[[-12,-82],[-8,-84],[0,-79],[11,-84],[12,-77],[4,-72],[-5,-73]],"#554641");
  ctx.fillStyle="#e2d6ba"; ctx.fillRect(-4,-74,8,5);
  line(ctx,[[-16,-62],[-11,-48],[13,-50]],"#524546",9);
  line(ctx,[[17,-61],[12,-49],[-10,-54]],"#443c40",9);
  ctx.restore();
}

function drawChild(t) {
  const p=player;
  let frame=0;
  if (p.action === "whip") frame=p.actionTime < .13 ? 8 : 9;
  else if (p.action === "shoot") frame=p.actionTime >= .12 && p.actionTime < .21 ? 11 : 10;
  else if (!p.ground) frame=p.vy < -160 ? 4 : p.vy < 92 ? 5 : 6;
  else if (p.landing > .06) frame=7;
  else if (Math.abs(p.vx) > 16) frame=[1,2,3,2][Math.floor(p.walk/15)%4];
  ctx.save();
  ctx.translate(Math.round(p.x),Math.round(p.y));
  ctx.scale(p.face,1);
  if (p.ground) {
    ctx.fillStyle="#132725a0"; ctx.fillRect(-14,-2,29,3);
  }
  if (childAtlas.complete && childAtlas.naturalWidth) {
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(childAtlas,(frame%4)*88,Math.floor(frame/4)*74,88,74,-50,-65,88,74);
  } else polygon(ctx,[[-12,0],[-8,-48],[0,-58],[11,-46],[10,0]],"#748a91");
  if (p.action === "whip") {
    const a=p.actionTime;
    ctx.beginPath();
    if (frame===8) {
      ctx.moveTo(-16,-28); ctx.bezierCurveTo(-38,-36,-66,-40,-64+120*a,-10);
    } else {
      const k=Math.min(1,(a-.13)/.23);
      ctx.moveTo(19,-36); ctx.bezierCurveTo(50,-47,112-k*66,-54+k*62,118-k*72,-33+k*19);
    }
    ctx.lineWidth=3; ctx.strokeStyle="#34272c"; ctx.stroke();
    ctx.lineWidth=1.5; ctx.strokeStyle="#d6ae7d"; ctx.stroke();
  }
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
