"use strict";

const WHIP_LINKS = 14;
const WHIP_LINK_LENGTH = 8.25;
const WHIP_SOLVER_PASSES = 24;
const WHIP_DURATION = .36;
const WHIP_STRIKE = .13;
const whipHands = [[-20,-28],[-23,-41],[29,-38],[33,-39],[10,-27]];
const originalWhipHands = [[-22,-43],[15,-34],[23,-49],[29,-33],[17,-31]];
const childWhipHands = [[-16,-28],[19,-36]];
const whipTipPath = [
  [0,-50,-14], [.05,-67,-60], [.085,-34,-94],
  [.109,50,-69], [WHIP_STRIKE,117,-37], [.163,121,-33],
  [.215,105,-18], [.27,71,-11], [.32,38,-13], [WHIP_DURATION,17,-25]
];
let whipNodes = [];

function whipPose(time) {
  if (time < .052) return 0;
  if (time < .112) return 1;
  if (time < .158) return 2;
  return time < .232 ? 3 : 4;
}

function whipAnchors(p) {
  const time = p.actionTime;
  const hands = combatAtlas.complete && combatAtlas.naturalWidth ? whipHands : originalWhipHands;
  const [hx,hy] = forest ? childWhipHands[time < .112 ? 0 : 1] : hands[whipPose(time)];
  const hand = {x:p.x+hx*p.face, y:p.y+hy};
  const next = whipTipPath.findIndex(([t])=>t>=time);
  const segment = next < 0 ? whipTipPath.length-2 : Math.max(0,next-1);
  const [start,x,y] = whipTipPath[segment];
  const [end,nextX,nextY] = whipTipPath[segment+1];
  const f = clamp((time-start)/(end-start),0,1);
  const tip = {x:p.x+(x+(nextX-x)*f)*p.face, y:p.y+y+(nextY-y)*f};
  return {hand,tip};
}

function resetWhip(p) {
  const {hand,tip} = whipAnchors(p);
  whipNodes = Array.from({length:WHIP_LINKS},(_,i)=>{
    const f = i/(WHIP_LINKS-1);
    const bow = Math.sin(Math.PI*f);
    const x = hand.x+(tip.x-hand.x)*f + 13*Math.sin(2*Math.PI*f)*p.face;
    const y = hand.y+(tip.y-hand.y)*f + 22*bow;
    return {x,y,px:x,py:y};
  });
  solveWhip(hand,tip,p.ground ? p.y-1 : Infinity);
}

function solveWhip(hand,tip,floor) {
  const last = whipNodes.length-1;
  Object.assign(whipNodes[0],hand);
  Object.assign(whipNodes[last],tip);
  for (let pass=0; pass<WHIP_SOLVER_PASSES; pass++) {
    // Alternate direction to distribute tension away from either pinned end.
    for (let j=0; j<last; j++) {
      const i = pass%2 ? last-1-j : j;
      const a = whipNodes[i], b = whipNodes[i+1];
      const dx = b.x-a.x, dy = b.y-a.y;
      const length = Math.hypot(dx,dy);
      if (length < .001) continue;
      const aFree = i !== 0, bFree = i+1 !== last;
      const correction = (length-WHIP_LINK_LENGTH)/(length*(aFree && bFree ? 2 : 1));
      if (aFree) {
        a.x += dx*correction;
        a.y = Math.min(floor,a.y+dy*correction);
      }
      if (bFree) {
        b.x -= dx*correction;
        b.y = Math.min(floor,b.y-dy*correction);
      }
    }
  }
}

function updateWhip(p,dt) {
  const {hand,tip} = whipAnchors(p);
  const damping = .98**(dt*60);
  const last = whipNodes.length-1;
  const oldHand = whipNodes[0], oldTip = whipNodes[last];
  for (let i=1; i<last; i++) {
    const n = whipNodes[i];
    const vx = (n.x-n.px)*damping, vy = (n.y-n.py)*damping;
    const f = i/last;
    // Follow fast anchors near either end without forcing the middle to move with them.
    const handWeight = (1-f)**3, tipWeight = f**3;
    const pullX = (hand.x-oldHand.x)*handWeight+(tip.x-oldTip.x)*tipWeight;
    const pullY = (hand.y-oldHand.y)*handWeight+(tip.y-oldTip.y)*tipWeight;
    n.px = n.x+pullX; n.py = n.y+pullY;
    n.x = n.px+vx; n.y = n.py+vy+890*dt*dt;
  }
  solveWhip(hand,tip,p.ground ? p.y-1 : Infinity);
}

function drawWhip(p) {
  if (p.action !== "whip" || !whipNodes.length) return;
  const last = whipNodes.length-1;
  const snap = p.actionTime >= WHIP_STRIKE && p.actionTime <= .183;
  ctx.save();
  ctx.globalAlpha = clamp((WHIP_DURATION-p.actionTime)/.066,0,1);
  for (let i=0; i<last; i++) {
    const a = whipNodes[i], b = whipNodes[i+1];
    const dx = b.x-a.x, dy = b.y-a.y;
    const radius = clamp(Math.hypot(dx,dy)*.56,2.1,7.4);
    ctx.beginPath();
    ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,radius,i%2 ? 2 : .95,Math.atan2(dy,dx),0,Math.PI*2);
    ctx.lineWidth = 2.8; ctx.strokeStyle = "#29252d"; ctx.stroke();
    ctx.lineWidth = 1.15; ctx.strokeStyle = snap ? "#f3dbb2" : i%2 ? "#c4af9e" : "#a58e84"; ctx.stroke();
  }
  const tip = whipNodes[last], prev = whipNodes[last-1];
  ctx.translate(tip.x,tip.y);
  ctx.rotate(Math.atan2(tip.y-prev.y,tip.x-prev.x)-Math.PI/2);
  polygon(ctx,[[-2,-1],[2,-1],[2,2],[6,2],[6,6],[2,6],[2,11],[-2,11],[-2,6],[-6,6],[-6,2],[-2,2]],"#3b2a30");
  ctx.fillStyle = snap ? "#f5dba7" : "#c5a892";
  ctx.fillRect(-1,0,2,10);
  ctx.fillRect(-5,3,10,2);
  ctx.fillStyle = "#f0d9b6"; ctx.fillRect(-1,3,2,2);
  ctx.restore();
}
