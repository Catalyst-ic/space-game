const $=s=>document.querySelector(s);
const W=1280,H=720;
const CHAPTER_REVEAL_MS=5200;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

$('#s-title').prepend($('#space-art-template').content.cloneNode(true));

/* ---------- scaling ---------- */
function fit(){
  const s=Math.min(innerWidth/W,innerHeight/H);
  const x=innerWidth/innerHeight>W/H?innerWidth/W:s;
  $('#stage').style.transform='translate(-50%,-50%) scale('+x+','+s+')'
}
addEventListener('resize',fit);fit();

/* ---------- photos ---------- */
const PH={};
function photo(name){if(!(name in PH)){PH[name]=null;const i=new Image();i.onload=()=>{PH[name]=i};i.onerror=()=>{PH[name]=false};i.src='assets/'+name}return PH[name]}
function drawPhoto(c,name,x,y,w,h,motionTime){
  const p=photo(name);if(!p)return;
  const t=Math.max(0,motionTime||0),direction=name.charCodeAt(5)%2?1:-1;
  const zoom=1.02+Math.min(.045,t*.0025),panX=direction*Math.sin(t*.16)*10,panY=Math.cos(t*.12)*5;
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  const s=Math.max(w/p.width,h/p.height);
  c.translate(x+w/2+panX,y+h/2+panY);c.scale(zoom,zoom);
  c.drawImage(p,-p.width*s/2,-p.height*s/2,p.width*s,p.height*s);c.restore()
}
['scene1.webp','scene2.webp','scene3.webp','scene4.webp','scene5.webp','scene6.webp','launch_bg.webp','rocket.webp','orbit.webp','cockpit.jpeg','ai-cockpit.jpeg','lunar-landing.jpg'].forEach(photo);

/* ---------- input ---------- */
const K={},M={x:0,y:0,down:false};
const DEFAULT_CONTROLS={keyboard:{advance:'Space',confirm:'Enter'},mouse:{advance:0,confirm:0},gamepad:{advance:0,confirm:1}};
const controls=JSON.parse(localStorage.getItem('space-controls')||JSON.stringify(DEFAULT_CONTROLS));
let listeningButton=null;
function bindingValue(path){return path.split('.').reduce((value,key)=>value[key],controls)}
function setBinding(path,value,label){
  const parts=path.split('.');controls[parts[0]][parts[1]]=value;
  document.getElementById(parts[0]+'-'+parts[1]).textContent=label;
  localStorage.setItem('space-controls',JSON.stringify(controls));
  if(listeningButton)listeningButton.classList.remove('listening');
  listeningButton=null;$('#binding-status').textContent='Saved '+label+'. Select another binding to change it.';
}
function startBinding(button){
  if(listeningButton)listeningButton.classList.remove('listening');
  listeningButton=button;button.classList.add('listening');
  const type=button.dataset.bind.split('.')[0];
  $('#binding-status').textContent=type==='gamepad'?'Press any controller button...':type==='mouse'?'Press a mouse button...':'Press a key...';
}
document.querySelectorAll('.binding-btn').forEach(button=>button.addEventListener('click',()=>startBinding(button)));
$('#settings-open').addEventListener('click',()=>{$('#settings-panel').classList.add('on');$('#settings-panel').setAttribute('aria-hidden','false')});
$('#settings-close').addEventListener('click',()=>{$('#settings-panel').classList.remove('on');$('#settings-panel').setAttribute('aria-hidden','true')});
$('#settings-reset').addEventListener('click',()=>{
  Object.keys(DEFAULT_CONTROLS).forEach(type=>Object.assign(controls[type],DEFAULT_CONTROLS[type]));
  document.querySelectorAll('.binding-btn').forEach(button=>{const path=button.dataset.bind;const value=bindingValue(path);button.querySelector('b').textContent=typeof value==='number'?(path.startsWith('mouse')?'Left click':gamepadLabel(value)):value});
  localStorage.setItem('space-controls',JSON.stringify(controls));$('#binding-status').textContent='Controls reset to defaults.';
});
function gamepadLabel(index){return ({0:'A / Cross',1:'B / Circle',2:'X / Square',3:'Y / Triangle'})[index]||'Button '+index}
function syncBindingLabels(){
  document.querySelectorAll('.binding-btn').forEach(button=>{
    const path=button.dataset.bind,value=bindingValue(path);
    button.querySelector('b').textContent=typeof value==='number'
      ?(path.startsWith('mouse')?['Left click','Middle click','Right click'][value]||'Button '+value:gamepadLabel(value))
      :value;
  });
}
syncBindingLabels();
addEventListener('keydown',e=>{
  if(listeningButton&&listeningButton.dataset.bind.startsWith('keyboard.')){e.preventDefault();setBinding(listeningButton.dataset.bind,e.code,e.code);return}
  K[e.code]=true;
  if(e.code===controls.keyboard.advance||e.code===controls.keyboard.confirm){e.preventDefault();advance()}
});
addEventListener('keyup',e=>{K[e.code]=false});
addEventListener('pointerup',e=>{
  M.down=false;
  if(listeningButton&&listeningButton.dataset.bind.startsWith('mouse.')){
    e.preventDefault();const label=['Left click','Middle click','Right click'][e.button]||'Button '+e.button;
    setBinding(listeningButton.dataset.bind,e.button,label);
  }
});
function pollGamepads(){
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  pads.forEach(pad=>{
    if(!pad)return;
    pad.buttons.forEach((button,index)=>{
      const key=pad.index+':'+index,pressed=button.pressed;
      if(listeningButton&&listeningButton.dataset.bind.startsWith('gamepad.')&&pressed&&!M[key]){
        setBinding(listeningButton.dataset.bind,index,gamepadLabel(index));
      }else if(!listeningButton&&pressed&&!M[key]&&(index===controls.gamepad.advance||index===controls.gamepad.confirm)){advance()}
      M[key]=pressed;
    });
  });
  requestAnimationFrame(pollGamepads);
}
pollGamepads();

/* ---------- dialogue ---------- */
let adv=null,skipT=null,autoPlay=false,autoTimer=null,autoDelay=0,advanceHintTimer=null;
const narrationHistory=[];
let restoreNarration=null;
function scheduleAutoAdvance(){
  clearTimeout(autoTimer);autoTimer=null;
  if(autoPlay&&adv)autoTimer=setTimeout(()=>{autoTimer=null;if(autoPlay&&adv)advance()},autoDelay)
}
function advance(){clearTimeout(autoTimer);autoTimer=null;if(skipT){skipT();return}if(adv)adv()}
$('#autoplay').addEventListener('change',e=>{autoPlay=e.target.checked;scheduleAutoAdvance()});
$('#dlg').addEventListener('pointerup',e=>{
  if(e.target.closest('button'))return;
  if(e.button===controls.mouse.advance)advance();
});
function say(who,text){return new Promise(res=>{$('#dlg').classList.add('on');$('#dn').textContent=who||'';const t=$('#dt');t.textContent='';let i=0,iv=null;
  narrationHistory.push({who:who||'',text});$('#dlg-back').style.visibility=narrationHistory.length>1?'visible':'hidden';
  clearTimeout(advanceHintTimer);$('#advance-hint').classList.remove('on');advanceHintTimer=setTimeout(()=>$('#advance-hint').classList.add('on'),4000);
  let rewound=false;
  const fin=()=>{clearInterval(iv);skipT=null;t.textContent=text;autoDelay=Math.max(2200,Math.min(9000,text.length*52+1200));adv=()=>{if(rewound){rewound=false;t.textContent=text;scheduleAutoAdvance();return}adv=null;res()};scheduleAutoAdvance()};
  restoreNarration=()=>{if(narrationHistory.length<2)return;if(skipT)skipT();const previous=narrationHistory[narrationHistory.length-2];$('#dn').textContent=previous.who;$('#dt').textContent=previous.text;rewound=true};
  skipT=fin;iv=setInterval(()=>{i++;t.textContent=text.slice(0,i);if(i>=text.length)fin()},22)})}
$('#dlg-back').addEventListener('click',e=>{
  e.stopPropagation();
  if(restoreNarration)restoreNarration();
});
function choose(opts){return new Promise(res=>{const box=$('#ch');box.innerHTML='';box.style.display='flex';
  opts.forEach(o=>{const b=document.createElement('button');b.className='btn alt';b.textContent=o.t;b.onclick=e=>{e.stopPropagation();box.style.display='none';box.innerHTML='';res(o.id)};box.appendChild(b)})})}

/* ---------- opening scenes: black and white, illustrated, past tense ---------- */
const oc=$('#oc').getContext('2d');
let oscene=null,ot0=0,otNow=0,previousScene=null,previousOt0=0,transitionAt=0;
const SCENE_TRANSITION=1400;
function bwtxt(c,s,x,y,size,col,align){c.fillStyle=col;c.font=size+'px "Bebas Neue",Impact,sans-serif';c.textAlign=align||'left';c.fillText(s,x,y);c.textAlign='left'}
function scEarth(c,t,lt){drawPhoto(c,'scene1.webp',0,0,W,H,lt)}
function scStations(c,t,lt){drawPhoto(c,'scene2.webp',0,0,W,H,lt)}
function scHouston(c,t,lt){drawPhoto(c,'scene3.webp',0,0,W,H,lt)}
function scSignal(c,t,lt){drawPhoto(c,'scene4.webp',0,0,W,H,lt)}
function scAnalysis(c,t,lt){drawPhoto(c,'scene5.webp',0,0,W,H,lt)}
function scPrep(c,t,lt){drawPhoto(c,'scene6.webp',0,0,W,H,lt)}
function scCockpit(c,t,lt){drawPhoto(c,'cockpit.jpeg',0,0,W,H,lt)}
function scAI(c,t,lt){drawPhoto(c,'ai-cockpit.jpeg',0,0,W,H,lt)}
function scLanding(c,t,lt){drawPhoto(c,'lunar-landing.jpg',0,0,W,H,lt)}
const ROCK={x0:460,y0:40,w:106,h:360};
function plume(c,x,y,t,lt){const f=70+Math.sin(t*30)*6+(lt-5)*4;const g=c.createLinearGradient(0,y,0,y+f);
  g.addColorStop(0,'rgba(240,240,240,.95)');g.addColorStop(1,'rgba(200,200,200,0)');c.fillStyle=g;
  c.beginPath();c.moveTo(x-16,y);c.quadraticCurveTo(x,y+f*1.25,x+16,y);c.closePath();c.fill()}
function launchPuffs(c,lt,padY){for(let i=0;i<46;i++){const age=((lt-5)*.32+i*.0217)%1;const sx=640+Math.sin(i*1.7)*(60+age*240);
    const sy=padY+30-age*300+(i%5)*5;const r=24+age*170;const a=.36*(1-age)*Math.min(1,age*6);
    c.fillStyle='rgba(205,205,205,'+a.toFixed(3)+')';c.beginPath();c.arc(sx,sy,r,0,7);c.fill()}}
function scLaunch(c,t,lt){const bg=photo('launch_bg.webp'),rk=photo('rocket.webp');
  if(!bg||!rk)return;
  const sx=W/1024,sy=H/572;
  let lift=0,shx=0,shy=0;
  if(lt>5){const k=lt-5;lift=k*k*6;shx=(Math.random()-.5)*3*Math.min(1,k/2);shy=(Math.random()-.5)*2*Math.min(1,k/2)}
  c.drawImage(bg,0,0,W,H);
  c.drawImage(rk,(ROCK.x0+shx)*sx,(ROCK.y0-lift+shy)*sy,ROCK.w*sx,ROCK.h*sy);
  if(lt>5){const base=(392-lift+shy)*sy;plume(c,512.5*sx+shx,base,t,lt);launchPuffs(c,lt,430*sy)}
  if(lt>5){const q0=Math.max(0,Math.min(1,(lt-5)/7));const cover=q0*q0*(3-2*q0);
    c.fillStyle='rgba(190,190,190,'+(cover*.92).toFixed(3)+')';c.fillRect(0,0,W,H);
    for(let i=0;i<70;i++){const q=((lt-5)*.22+i*.0143)%1;const x=(i*197)%W;const y=H*(.15+.75*((i*.37)%1));const r=140+q*320;
      c.fillStyle='rgba(222,222,222,'+(cover*.22*(1-q*.5)).toFixed(3)+')';c.beginPath();c.arc(x,y,r,0,7);c.fill()}}
  if(lt<5){bwtxt(c,String(5-Math.floor(lt)),640,320,240,'rgba(228,228,228,.9)','center')}
  else if(lt<6.5){bwtxt(c,'LIFTOFF',640,250,120,'rgba(228,228,228,.9)','center')}}
function scOrbit(c,t,lt){const p=photo('orbit.webp');
  if(p)c.drawImage(p,0,0,W,H);
  const smoke=Math.max(0,1-(lt||0)/3)*.92;if(smoke>0){c.fillStyle='rgba(190,190,190,'+smoke.toFixed(3)+')';c.fillRect(0,0,W,H)}}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function cockpitView(c,t){
  // window bezel: dark frame around a rounded glass window
  c.save();c.beginPath();c.rect(0,0,W,H);roundRect(c,58,36,W-116,520,46);c.fillStyle='#0c0c0c';c.fill('evenodd');
  c.strokeStyle='#2a2a2a';c.lineWidth=3;roundRect(c,58,36,W-116,520,46);c.stroke();
  // window struts
  c.fillStyle='#161616';c.fillRect(636,36,8,520);c.fillRect(58,300,W-116,8);
  // console
  const g=c.createLinearGradient(0,556,0,H);g.addColorStop(0,'#1a1a1a');g.addColorStop(1,'#050505');
  c.fillStyle=g;c.beginPath();c.moveTo(0,556);c.lineTo(W,556);c.lineTo(W,H);c.lineTo(0,H);c.closePath();c.fill();
  c.strokeStyle='#3a3a3a';c.lineWidth=2;c.beginPath();c.moveTo(0,556);c.lineTo(W,556);c.stroke();
  // dials and switches
  for(let i=0;i<9;i++){const x=150+i*115;c.fillStyle='#0d0d0d';c.beginPath();c.arc(x,630,30,0,7);c.fill();c.strokeStyle='#4a4a4a';c.lineWidth=3;c.stroke();
    c.strokeStyle='#8a8a8a';c.beginPath();c.moveTo(x,630);c.lineTo(x+Math.cos(i+t*.3)*22,630+Math.sin(i+t*.3)*22);c.stroke()}
  for(let i=0;i<14;i++){c.fillStyle=(i%5===0)?'#e8a33d':'#2a2a2a';c.fillRect(120+i*72,680,26,12)}
  // glass glare
  const gl=c.createLinearGradient(0,36,W*.6,556);gl.addColorStop(0,'rgba(255,255,255,0.10)');gl.addColorStop(.45,'rgba(255,255,255,0)');
  c.fillStyle=gl;roundRect(c,66,44,W-132,504,40);c.fill();
  c.restore()}
function oloop(now){const dt=Math.min(.05,(now-otNow)/1000);otNow=now;const t=now/1000;
  if(oscene){
    oc.setTransform(1,0,0,1,0,0);
    const progress=Math.min(1,(now-transitionAt)/SCENE_TRANSITION);
    const eased=progress*progress*(3-2*progress);
    oc.clearRect(0,0,W,H);
    if(previousScene&&progress<1){
      oc.save();oc.globalAlpha=1-eased;previousScene(oc,t,t-previousOt0);oc.restore();
      oc.save();oc.globalAlpha=eased;oscene(oc,t,t-ot0);oc.restore();
    }else{
      oscene(oc,t,t-ot0);
    }
    for(let i=0;i<420;i++){oc.fillStyle='rgba(255,255,255,'+(Math.random()*.07)+')';oc.fillRect(Math.random()*W,Math.random()*H,1,1)}
  }
  requestAnimationFrame(oloop)}
requestAnimationFrame(oloop);
function setOscene(fn){
  const now=performance.now();
  previousScene=oscene;previousOt0=ot0;oscene=fn;ot0=now/1000;transitionAt=now;
}
async function shotDissolve(fn,lines,hold){setOscene(fn);for(const l of lines){if(Array.isArray(l))await say(l[0],l[1]);else await say('',l)}if(hold)await sleep(hold)}
async function shot(fn,lines,hold){setOscene(fn);await sleep(SCENE_TRANSITION);
  for(const l of lines){if(Array.isArray(l))await say(l[0],l[1]);else await say('',l)}if(hold)await sleep(hold)}

/* ---------- opening story ---------- */
async function opening(){
  const title=$('#s-title'),open=$('#s-open');
  $('#go').disabled=true;setOscene(scEarth);open.classList.add('on');open.style.opacity='0';
  title.style.transition='opacity 1.6s ease';open.style.transition='opacity 1.6s ease';
  requestAnimationFrame(()=>{title.style.opacity='0';open.style.opacity='1'});
  await sleep(1600);title.classList.remove('on');title.style.opacity='';title.style.transition='';open.style.opacity='';open.style.transition='';
  await shotDissolve(scEarth,[
    ['NARRATOR','Once, people looked up at the sky every night. Children waved at the satellites crossing overhead.'],
    ['NARRATOR','Then they decided there was nothing left out there to find. The stations were closed one by one, and the telescopes were switched off.']
  ],800);
  await shot(scStations,[
    ['NARRATOR','The last stations were emptied. Their lights went out, and nobody came back to check on them.'],
    ['NARRATOR','But the machines were still out there. Rovers on other worlds. Probes still flying away. Nobody remembered to listen.']
  ],800);
  await shot(scHouston,[
    ['NARRATOR','Only one room stayed open in Houston. A few engineers, a few screens, and a coffee machine that never stopped working.'],
    ['NARRATOR','Most days, nothing happened at all.']
  ],600);
  await shot(scSignal,[
    ['NARRATOR','On an ordinary Tuesday, the big dish caught something.'],
    ['NARRATOR','A steady signal, repeating like a heartbeat, from a place where nothing should be sending.'],
    ['CONTROL','Nobody knows what it is.']
  ],800);
  await shot(scAnalysis,[
    ['NARRATOR','For four days they searched every old record they could find. They found nothing. The signal kept repeating, as if it were waiting for someone to answer.']
  ],1200);
  await shot(scPrep,[
    ['NARRATOR','On the fifth morning they made a decision. One person would go out and find out what the signal was.'],
    ['NARRATOR','They picked you.']
  ],800);
  await shot(scLaunch,[
    ['CONTROL','Liftoff.'],
    ['NARRATOR','The ground fell away, and the whole room went quiet.']
  ],8000);
  await shotDissolve(scOrbit,[
    ['NARRATOR','The engines cut off. Silence. Below you, the Earth. Above you, the signal, still waiting.'],
    ['CONTROL','Welcome to orbit.'],
    ['NARRATOR','Remember this: every machine out there was built by someone who hoped that someone would come back for it.']
  ],0);
  await shot(scCockpit,[
    ['CONTROL','Your mission starts now. The signal is waiting.']
  ],1000);
  await shot(scAI,[
    ['SHIP AI',"I am AURA, your ship's onboard intelligence. The signal appears to be coming from the Moon."]
  ],1200);
  await shot(scLanding,[
    ['CONTROL','Signal locked. Beginning lunar descent.'],
    ['CONTROL','Lunar landing confirmed. Prepare for surface operations.']
  ],1200);
  await sleep(500);
  await beginButton();
}

/* ---------- begin ---------- */
async function beginButton(){
  const fade=$('#fade');
  fade.style.transition='opacity 1.4s ease';
  fade.style.opacity='1';
  await sleep(1400);
  return new Promise(res=>{
  $('#dlg').classList.remove('on');
  const screen=document.createElement('div');screen.id='begin-screen';screen.className='launch-screen';
  screen.appendChild($('#space-art-template').content.cloneNode(true));
  const copy=document.createElement('div');copy.className='launch-copy begin-copy';
  const kick=document.createElement('div');kick.className='launch-kicker';kick.textContent='Chapter 1 · The Moon';
  const title=document.createElement('h1');title.className='launch-title';title.append('The moon',document.createElement('br'),'is waiting');
  const intro=document.createElement('p');intro.textContent='The signal is waiting.';
  const button=document.createElement('button');button.id='beginbtn';button.className='launch-btn';button.append('Begin');
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='→';button.appendChild(arrow);
  button.onclick=()=>{
    button.disabled=true;
    window.location.assign('./lunar-survey.html');
  };
  screen.style.clipPath='inset(100% 0 0 0)';
  screen.style.transition='clip-path '+CHAPTER_REVEAL_MS+'ms cubic-bezier(.22,.61,.36,1)';
  copy.append(kick,title,intro,button);screen.appendChild(copy);
  document.getElementById('s-open').appendChild(screen);
  requestAnimationFrame(()=>{
    screen.style.clipPath='inset(0 0 0 0)';
    fade.style.transition='opacity 3.6s ease';
    fade.style.opacity='0';
  })
})}
$('#go').addEventListener('click',()=>{opening()});