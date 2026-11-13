(() => {
  'use strict';
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const ui = {
    hotbar: document.getElementById('hotbar'), inventory: document.getElementById('inventory-list'), packCount: document.getElementById('pack-count'),
    questCount: document.getElementById('block-count'), xp: document.getElementById('xp-fill'), level: document.getElementById('level'), coords: document.getElementById('coords'),
    hint: document.getElementById('interaction-hint'), toast: document.getElementById('toast'), modal: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'), modalCopy: document.getElementById('modal-copy'), modalContent: document.getElementById('modal-content')
  };
  const TILE_W=58, TILE_H=29, BLOCK_H=21, SIZE=36;
  const defs={grass:{name:'Grass',color:'#83b967',side:'#698f53',top:'#9ccc70',item:'#87bd69'},dirt:{name:'Soft dirt',color:'#9b7552',side:'#79583f',top:'#b68b61',item:'#a67b54'},wood:{name:'Oak wood',color:'#a97848',side:'#805637',top:'#c2935b',item:'#b9854d'},leaves:{name:'Leafy bits',color:'#5f9a58',side:'#477947',top:'#78b76c',item:'#6da665'},stone:{name:'Stone',color:'#929b94',side:'#707a74',top:'#b5bdb4',item:'#9aa49c'},sand:{name:'Sand',color:'#d8c184',side:'#b89d62',top:'#eddaa1',item:'#e0ca8c'},flower:{name:'Wildflower',color:'#e4ae55',side:'#ae8550',top:'#f4d276',item:'#e2b451'}};
  const ids=['grass','dirt','wood','leaves','stone','sand'];
  const inv={grass:4,dirt:2,wood:3,leaves:1,stone:1,sand:1};
  const player={x:17,y:17,face:{x:1,y:0}};
  let selected=0, gathered=0, level=1, elapsed=0, toastTimer=0, hintTimer=0, collapsed=false, pointer={x:-1000,y:-1000}, hover=null;
  let vw=innerWidth,vh=innerHeight,dpr=1;
  const cells=Array.from({length:SIZE},()=>Array(SIZE));
  const trees=[];
  function hash(x,y){const n=Math.sin(x*127.1+y*311.7+7.13)*43758.5453;return n-Math.floor(n)}
  function heightAt(x,y){return Math.max(0,Math.min(3,Math.floor(1.05+Math.sin(x*.29)*.55+Math.cos(y*.25)*.46+Math.sin((x+y)*.19)*.32+(hash(x,y)-.5)*.8)))}
  function isWater(x,y){const a=Math.pow((x-8)/4.3,2)+Math.pow((y-25)/3.2,2);const b=Math.pow((x-29)/3.3,2)+Math.pow((y-7)/4.2,2);return a<1||b<1}
  function cellAt(x,y){return cells[y]&&cells[y][x]}
  function makeWorld(){
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const water=isWater(x,y), h=water?0:heightAt(x,y), top=water?'sand':((x<4||y<3||x>32||y>32)?'sand':'grass');
      const stack=[];
      for(let z=0;z<h;z++)stack.push({type:'dirt',terrain:true});
      stack.push({type:top,terrain:true});
      if(water&&hash(x+19,y+33)>.25)stack.push({type:'water',terrain:true});
      cells[y][x]={stack,ground:h,water,top,decor:null};
    }
    for(let y=3;y<SIZE-3;y++)for(let x=3;x<SIZE-3;x++){
      const c=cellAt(x,y),r=hash(x*3+12,y*5+8);
      if(!c.water&&c.top==='grass'&&r>.982&&Math.abs(x-player.x)+Math.abs(y-player.y)>6){
        c.stack.push({type:'stone',terrain:false});c.stack.push({type:'stone',terrain:false});
      } else if(!c.water&&c.top==='grass'&&r>.88&&r<.897&&Math.abs(x-player.x)+Math.abs(y-player.y)>4){
        plantTree(x,y);
      } else if(!c.water&&c.top==='grass'&&r>.84&&r<.858){c.decor='flower'}
    }
    // A cozy cluster of trees near the edge of the clearing.
    [[11,11],[10,13],[25,23],[27,24],[7,20],[23,9]].forEach(([x,y])=>{if(cellAt(x,y)&&!cellAt(x,y).water)plantTree(x,y)});
  }
  function plantTree(x,y){
    const c=cellAt(x,y);if(!c||c.tree)return;c.tree=true;const base=c.stack.length;
    for(let i=0;i<3;i++)c.stack.push({type:'wood',terrain:false,tree:true});
    [[0,0],[1,0],[-1,0],[0,1],[0,-1],[0,0]].forEach(([dx,dy],i)=>{const xx=x+dx,yy=y+dy,cc=cellAt(xx,yy);if(cc&&!cc.water)cc.stack.push({type:'leaves',terrain:false,tree:true,canopy:i>4})});
    trees.push({x,y,base});
  }
  makeWorld();
  function resize(){dpr=Math.min(devicePixelRatio||1,2);vw=innerWidth;vh=innerHeight;canvas.width=Math.floor(vw*dpr);canvas.height=Math.floor(vh*dpr);canvas.style.width=vw+'px';canvas.style.height=vh+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  function project(x,y,z){const cx=vw*.5-(player.x-player.y)*TILE_W/2,cy=vh*.53-(player.x+player.y)*TILE_H/2;return {x:cx+(x-y)*TILE_W/2,y:cy+(x+y)*TILE_H/2-z*BLOCK_H}}
  function poly(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke()}}
  function drawCube(x,y,z,type,options={}){
    const p=project(x,y,z), w=TILE_W/2,h=TILE_H/2,bh=BLOCK_H;
    const top=[[p.x,p.y],[p.x+w,p.y+h],[p.x,p.y+TILE_H],[p.x-w,p.y+h]];
    const left=[[p.x-w,p.y+h],[p.x,p.y+TILE_H],[p.x,p.y+TILE_H+bh],[p.x-w,p.y+h+bh]];
    const right=[[p.x,p.y+TILE_H],[p.x+w,p.y+h],[p.x+w,p.y+h+bh],[p.x,p.y+TILE_H+bh]];
    if(type==='water'){
      poly([[p.x-w,p.y+h],[p.x,p.y],[p.x+w,p.y+h],[p.x,p.y+TILE_H]],'#88d0cf');
      ctx.strokeStyle='#c1eeea';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x-10,p.y+14);ctx.lineTo(p.x+2,p.y+8);ctx.stroke();return;
    }
    const d=defs[type]||defs.grass, side=options.ghost?'#75a78288':d.side, rightC=options.ghost?'#67977588':d.color;
    poly(left,side,'#46634525');poly(right,rightC,'#46634525');poly(top,options.ghost?'#b8d78eaa':d.top,'#ffffff25');
    if(type==='grass'&&!options.ghost){
      ctx.fillStyle='#78ad60';for(let i=0;i<3;i++){const fx=p.x+(i-1)*7,fy=p.y+13+(i%2)*2;ctx.fillRect(fx,fy,2,2)}
    } else if(type==='stone'&&!options.ghost){ctx.fillStyle='#ffffff38';ctx.fillRect(p.x-8,p.y+8,5,2);ctx.fillRect(p.x+3,p.y+14,4,2)}
    else if(type==='wood'&&!options.ghost){ctx.strokeStyle='#e7c38a66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-7,p.y+8);ctx.lineTo(p.x+1,p.y+12);ctx.moveTo(p.x+4,p.y+13);ctx.lineTo(p.x+10,p.y+10);ctx.stroke()}
    if(options.highlight){ctx.strokeStyle='#ffffd5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...top[0]);top.slice(1).forEach(pt=>ctx.lineTo(...pt));ctx.closePath();ctx.stroke()}
  }
  function drawFlower(x,y,z){const p=project(x,y,z);ctx.strokeStyle='#648c55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y+10);ctx.lineTo(p.x,p.y-2);ctx.stroke();ctx.fillStyle='#f2c65e';ctx.beginPath();ctx.arc(p.x,p.y-4,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0c1';ctx.beginPath();ctx.arc(p.x+1,p.y-4,1.3,0,Math.PI*2);ctx.fill()}
  function drawPlayer(){
    const floor=cellAt(player.x,player.y);if(!floor)return;const p=project(player.x,player.y,floor.stack.length);const bob=Math.sin(elapsed*3)*1.2;
    // soft little shadow
    ctx.fillStyle='#405d3c25';ctx.beginPath();ctx.ellipse(p.x,p.y+15,13,5,0,0,Math.PI*2);ctx.fill();
    // backpack and body
    ctx.fillStyle='#bc7950';roundRect(p.x-10,p.y-17+bob,7,17,3);ctx.fill();
    ctx.fillStyle='#678e68';roundRect(p.x-7,p.y-19+bob,15,20,5);ctx.fill();
    ctx.fillStyle='#e9bb8c';ctx.beginPath();ctx.arc(p.x,p.y-24+bob,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#805b42';ctx.beginPath();ctx.arc(p.x-1,p.y-27+bob,8,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(p.x-8,p.y-27+bob,15,4);
    ctx.fillStyle='#405645';ctx.beginPath();ctx.arc(p.x+3,p.y-23+bob,1.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e6d6ad';roundRect(p.x-6,p.y-2+bob,5,9,2);ctx.fill();roundRect(p.x+2,p.y-2+bob,5,9,2);ctx.fill();
  }
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
  function drawWorld(){
    ctx.clearRect(0,0,vw,vh);
    // Ground horizon haze, with soft cloud puffs.
    ctx.save();const sky=ctx.createLinearGradient(0,0,0,vh);sky.addColorStop(0,'#a5dce7');sky.addColorStop(.52,'#d9eee0');sky.addColorStop(1,'#b7d996');ctx.fillStyle=sky;ctx.fillRect(0,0,vw,vh);
    drawCloud(vw*.28+Math.sin(elapsed*.05)*9,vh*.19,1);drawCloud(vw*.73-Math.sin(elapsed*.04)*8,vh*.16,.72);
    ctx.restore();
    const list=[];for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const c=cellAt(x,y);if(!c)continue;for(let z=0;z<c.stack.length;z++)list.push({x,y,z,block:c.stack[z],depth:x+y+z*.01});if(c.decor)list.push({x,y,z:c.stack.length,flower:true,depth:x+y+.2})}
    list.sort((a,b)=>a.depth-b.depth||a.x-b.x);
    for(const o of list){if(o.flower)drawFlower(o.x,o.y,o.z);else drawCube(o.x,o.y,o.z,o.block.type,{highlight:hover&&hover.x===o.x&&hover.y===o.y&&hover.z===o.z})}
    // Water glints
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const c=cellAt(x,y);if(c&&c.water&&hash(x*19,y*29)>.86){const p=project(x,y,c.stack.length);ctx.fillStyle='#e4ffff88';ctx.fillRect(p.x-2+Math.sin(elapsed+x)*3,p.y+12,5,1.3)}}
    drawPlayer();
    if(hover){const p=project(hover.x,hover.y,hover.z);ctx.strokeStyle='#fff9ce';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+TILE_W/2,p.y+TILE_H/2);ctx.lineTo(p.x,p.y+TILE_H);ctx.lineTo(p.x-TILE_W/2,p.y+TILE_H/2);ctx.closePath();ctx.stroke()}
  }
  function drawCloud(x,y,s){ctx.fillStyle='#ffffff55';ctx.beginPath();ctx.ellipse(x,y,29*s,8*s,0,0,Math.PI*2);ctx.ellipse(x-13*s,y-4*s,12*s,9*s,0,0,Math.PI*2);ctx.ellipse(x+2*s,y-7*s,16*s,12*s,0,0,Math.PI*2);ctx.ellipse(x+17*s,y-2*s,11*s,8*s,0,0,Math.PI*2);ctx.fill()}
  function updateHUD(){
    const total=Object.values(inv).reduce((a,b)=>a+b,0);ui.packCount.textContent=total;ui.questCount.textContent=`${Math.min(gathered,8)} / 8`;ui.level.textContent=String(level).padStart(2,'0');ui.xp.style.width=`${Math.min(100,(gathered%8)*12.5+18)}%`;ui.coords.textContent=`${player.x-17}, ${player.y-17}`;
    ui.inventory.innerHTML=ids.map(id=>`<div class="inv-row ${ids[selected]===id?'selected':''}" data-id="${id}"><span class="inv-swatch" style="background:linear-gradient(135deg,${defs[id].top} 0 42%,${defs[id].color} 43% 68%,${defs[id].side} 69%)"></span><span class="inv-name">${defs[id].name}</span><span class="inv-qty">×${inv[id]||0}</span></div>`).join('');
    ui.hotbar.innerHTML=ids.map((id,i)=>`<button class="hot-slot ${selected===i?'active':''}" data-slot="${i}" aria-label="${defs[id].name}, ${inv[id]||0} blocks"><span class="slot-num">${i+1}</span><span class="block-icon" style="background:linear-gradient(135deg,${defs[id].top} 0 40%,${defs[id].color} 41% 68%,${defs[id].side} 69%)"></span><span class="slot-count">${inv[id]||0}</span></button>`).join('');
    ui.hotbar.querySelectorAll('.hot-slot').forEach(el=>el.addEventListener('click',()=>selectSlot(+el.dataset.slot)));
    ui.inventory.querySelectorAll('.inv-row').forEach(el=>el.addEventListener('click',()=>selectSlot(ids.indexOf(el.dataset.id))));
    document.getElementById('quest-text').textContent=gathered>=8?'You made a lovely start!':'Make something wonderful';
  }
  function selectSlot(i){selected=(i+ids.length)%ids.length;updateHUD()}
  function toast(message){ui.toast.textContent=message;ui.toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('visible'),1900)}
  function showModal(title,copy,content='') {ui.modalTitle.textContent=title;ui.modalCopy.innerHTML=copy;ui.modalContent.innerHTML=content;ui.modal.hidden=false}
  function closeModal(){ui.modal.hidden=true}
  function saveGame(){try{localStorage.setItem('blockhaven-save',JSON.stringify({player,inv,gathered,level,stacks:cells.map(row=>row.map(c=>c.stack))}));document.querySelector('.save-btn span:last-child').textContent='Saved';toast('Your little world is saved ✦')}catch(e){toast('Could not save in this browser')}}
  function loadGame(){try{const data=JSON.parse(localStorage.getItem('blockhaven-save'));if(!data)return false;player.x=Math.max(1,Math.min(SIZE-2,data.player.x));player.y=Math.max(1,Math.min(SIZE-2,data.player.y));player.face=data.player.face||player.face;Object.assign(inv,data.inv||{});gathered=data.gathered||0;level=data.level||1;if(data.stacks)cells.forEach((row,y)=>row.forEach((c,x)=>{if(data.stacks[y]&&data.stacks[y][x])c.stack=data.stacks[y][x]}));return true}catch(e){return false}}
  function nearestTarget(px,py){
    let best=null,bestScore=Infinity;
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const c=cellAt(x,y);if(!c||!c.stack.length)continue;
      const z=c.stack.length-1, p=project(x,y,z),dx=Math.abs(px-p.x),dy=Math.abs(py-(p.y+TILE_H/2));
      const inside=dx/(TILE_W/2)+dy/(TILE_H/2)<=1.15;
      if(!inside)continue;const score=dx*dx+dy*dy-(x===player.x&&y===player.y?30:0);
      if(score<bestScore){bestScore=score;best={x,y,z,block:c.stack[z],score}}
    }
    return best;
  }
  function pointerMove(e){const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;hover=nearestTarget(pointer.x,pointer.y);if(hover){ui.hint.classList.add('show');hintTimer=performance.now()}else ui.hint.classList.remove('show')}
  function gather(target=hover){
    if(!target){toast('Point to a block in the meadow');return}
    const c=cellAt(target.x,target.y);if(!c||!c.stack.length)return;
    const block=c.stack.pop();if(block.type==='water'){c.stack.push(block);return}
    const kind=block.type==='flower'?'flower':block.type;inv[kind]=(inv[kind]||0)+1;gathered++;
    if(c.decor&&target.z>=c.stack.length){c.decor=null;inv.flower=(inv.flower||0)+1}
    if(gathered>0&&gathered%8===0){level++;toast('Level up! You have a lovely eye for this ✦')}else toast(`+1 ${defs[kind]?.name||'wildflower'}`);
    updateHUD();
  }
  function place(){
    const id=ids[selected];if((inv[id]||0)<1){toast(`You're all out of ${defs[id].name.toLowerCase()}`);return}
    let x=player.x+player.face.x,y=player.y+player.face.y;if(x<1||y<1||x>=SIZE-1||y>=SIZE-1){toast('That is the edge of your little world');return}
    let c=cellAt(x,y);if(c.water||c.tree){toast('Find a little clearing to build there');return}
    if(c.stack.length-c.ground>1){toast('That spot is already getting tall!');return}
    c.stack.push({type:id,terrain:false,placed:true});inv[id]--;updateHUD();toast(`${defs[id].name} placed ✦`);
  }
  function move(dx,dy){const x=player.x+dx,y=player.y+dy;if(x<1||y<1||x>=SIZE-1||y>=SIZE-1)return;const c=cellAt(x,y);if(!c||c.water||c.tree)return;player.x=x;player.y=y;player.face={x:dx,y:dy};updateHUD()}
  function playTick(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=660;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.09);o.start();o.stop(a.currentTime+.1);o.onended=()=>a.close()}catch(e){}}
  if(loadGame())toast('Welcome back to Sunmeadow ✦');updateHUD();
  canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerleave',()=>{hover=null;ui.hint.classList.remove('show')});
  canvas.addEventListener('click',e=>{pointerMove(e);gather(hover);if(document.getElementById('sound-btn').dataset.on==='true')playTick()});
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();place()});
  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
    if(k==='w'||k==='arrowup')move(0,-1);else if(k==='s'||k==='arrowdown')move(0,1);else if(k==='a'||k==='arrowleft')move(-1,0);else if(k==='d'||k==='arrowright')move(1,0);
    else if(k>='1'&&k<='6')selectSlot(+k-1);else if(k===' '||k==='e')place();else if(k==='?'||k==='/')showModal('A world of your own','Wander around with <b>W A S D</b> or the arrow keys. Click blocks to gather them, then pick a material and right-click (or press <b>Space</b>) to build.','');
  });
  canvas.addEventListener('wheel',e=>{selectSlot(selected+(e.deltaY>0?1:-1));e.preventDefault()},{passive:false});
  document.getElementById('save-btn').addEventListener('click',saveGame);
  document.getElementById('help-btn').addEventListener('click',()=>showModal('A world of your own','Wander around with <b>W A S D</b> or the arrow keys. Click a block to gather it, then choose a material and right-click (or press <b>Space</b>) to build. On a phone, use the little arrows and Gather / Place buttons.',''));
  document.getElementById('modal-close').addEventListener('click',closeModal);document.getElementById('modal-ok').addEventListener('click',closeModal);ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal()});
  document.getElementById('journal-btn').addEventListener('click',()=>showModal('Your meadow journal',`So far, you have gathered <b>${gathered}</b> blocks and reached level <b>${String(level).padStart(2,'0')}</b>. Every corner of Sunmeadow is yours to shape.`,`<div style="padding:8px;background:#f2f1e2;border-radius:9px">${gathered>=8?'✦ First steps complete — the meadow is yours!':'✧ Little goal: gather 8 blocks to finish your first adventure.'}</div>`));
  document.getElementById('rename-btn').addEventListener('click',()=>{const name=prompt('What should we call your explorer?','Little Builder');if(name&&name.trim())document.querySelector('.player-name').textContent=name.trim().slice(0,20)});
  document.getElementById('pack-toggle').addEventListener('click',()=>{collapsed=!collapsed;ui.inventory.style.display=collapsed?'none':'flex';document.querySelector('.panel-foot').style.display=collapsed?'none':'block';document.getElementById('pack-toggle').textContent=collapsed?'⌃':'⌄'});
  document.getElementById('sound-btn').addEventListener('click',e=>{const b=e.currentTarget;b.dataset.on=b.dataset.on!=='true'?'true':'false';b.style.background=b.dataset.on==='true'?'#dcebd4':'rgba(255,255,249,.7)';toast(b.dataset.on==='true'?'A little chime is on ♪':'Sound is off')});
  document.querySelectorAll('.touch-controls button').forEach(btn=>{const dir=btn.dataset.dir;const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};let timer;const start=e=>{e.preventDefault();move(...map[dir]);timer=setInterval(()=>move(...map[dir]),190)};const end=()=>clearInterval(timer);btn.addEventListener('pointerdown',start);btn.addEventListener('pointerup',end);btn.addEventListener('pointerleave',end);btn.addEventListener('pointercancel',end)});
  document.getElementById('mobile-gather').addEventListener('click',()=>{if(!hover){let candidates=[];for(let y=player.y-2;y<=player.y+2;y++)for(let x=player.x-2;x<=player.x+2;x++){const c=cellAt(x,y);if(c&&c.stack.length)candidates.push({x,y,z:c.stack.length-1,block:c.stack.at(-1),score:Math.abs(x-player.x)+Math.abs(y-player.y)})}candidates.sort((a,b)=>a.score-b.score);gather(candidates[0])}else gather()});document.getElementById('mobile-place').addEventListener('click',place);
  let rendering=true;window.__blockhavenPause=()=>{rendering=false};window.__blockhavenResume=()=>{if(!rendering){rendering=true;requestAnimationFrame(frame)}};
  function frame(now){elapsed=now/1000;drawWorld();if(hover&&now-hintTimer>2300)ui.hint.classList.remove('show');if(rendering)requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();
