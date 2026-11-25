import * as T from 'three'
import {actor,runner,arena,heaven,sword,forward} from './world.js'
import {Combat} from './combat.js'
import {animateCharacter} from './character.js'
import {rocksReady} from './rocks.js'
import {pillarsReady} from './pillars.js'
import {stages,generateRoute} from './stage.js'
import {axis,pressed,held} from './input.js'
const $=s=>document.querySelector(s), menu=$('#menu'),hud=$('#hud'),hint=$('#hint')
const renderer=new T.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));document.body.prepend(renderer.domElement)
const scene=new T.Scene(), camera=new T.PerspectiveCamera(56,1,.1,180)
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
resize();addEventListener('resize',resize)
const light=new T.HemisphereLight(0xffe8ce,0xbc7773,2.1);scene.add(light)
const sun=new T.DirectionalLight(0xffdcba,2.5);sun.position.set(-8,16,5);scene.add(sun)
const group=()=>{const g=new T.Group();scene.add(g);return g}
const track=group(),room=group(),sky=group();heaven(sky)
const player=actor(scene), boss=actor(room,true), loot=sword(room,0,1,0)
const animatePlayer=animateCharacter(player)
let state,prior,cfg,route,doors,combat,age,elapsed,retries,checkpoint,vertical,strafe,clock,stageId,dist,lat,height,ready=0,surge=1,jumpBuffer=0,squash=0,best=0,pending=[],stageScore=0,stageEmbers=0,score=0,embers=0
const progress={swords:new Set(),stages:new Set()}
const aim=new T.Vector3(),eye=new T.Vector3(),focus=new T.Vector3(),dir=new T.Vector3(),UP=new T.Vector3(0,1,0)
function set(s){state=s;age=0;hint.textContent='';pressed.clear()}
function panel(title,copy,actions){
  menu.hidden=false;hud.hidden=$('#score').hidden=true;hint.textContent=''
  $('h1').innerHTML=title;$('#copy').textContent=copy;$('#buttons').replaceChildren()
  for(const [name,fn] of actions){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{b.blur();fn()};$('#buttons').append(b)}
}
function play(){menu.hidden=true;hud.hidden=$('#score').hidden=false}
function load(id){
  combat?.dispose();track.clear();room.clear();room.add(boss,loot)
  stageId=id;cfg=stages[id];route=runner(track,cfg,generateRoute(cfg));doors=arena(room,cfg)
  scene.background=new T.Color(cfg.sky);scene.fog=new T.FogExp2(cfg.sky,.017)
  stageScore=score;stageEmbers=embers;checkpoint=clock=best=0;resetRunner();set('run')
}
// Jump tuning: a quick rise and a heavier fall feel snappy; the jump still clears a gap at the lowest speed.
const JUMP=13, RISE_GRAVITY=38, FALL_GRAVITY=52, JUMP_BUFFER=.15
// After a respawn the runner waits briefly, then builds back up from base speed (forgiving checkpoints).
const RESPAWN_PAUSE=.6, RESPAWN_RAMP=1.4
let runPace=0
function resetRunner(respawn=false){
  track.visible=true;room.visible=sky.visible=false;player.visible=true
  dist=checkpoint;lat=height=vertical=strafe=squash=jumpBuffer=0;player.scale.set(1,1,1)
  ready=respawn?RESPAWN_PAUSE:0;surge=respawn?0:1;runPace=0;pending=[]
  place();runnerView(camera.position,aim)
}
function restartStage(){
  score=stageScore;embers=stageEmbers;best=checkpoint=0;showScore()
  for(const e of route.pickups){e.taken=false;e.mesh.visible=true}
  resetRunner()
}
function showScore(pop=false){
  $('#points').textContent=score;$('#embers').textContent='✦ '+embers
  if(pop){const el=$('#points');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
}
function die(){
  for(const e of pending){e.taken=false;e.mesh.visible=true;embers--;score-=cfg.embers.value} // undo embers since checkpoint
  pending=[];showScore();retries++;set('fall');hint.textContent='Returning to checkpoint'
}
// Runner state lives in route space (dist along the path, lat to its right, height); place() maps it to the world.
function place(){const h=route.at(dist,lat,player.position);player.position.y=height;player.rotation.set(0,h,-strafe*.015)}
function runnerView(eyeOut,focusOut){
  const h=route.at(dist,lat*.45,eyeOut);eyeOut.addScaledVector(forward(h,dir),-8);eyeOut.y=4.8+height*.15
  route.at(dist,lat*.3,focusOut);focusOut.addScaledVector(dir,5);focusOut.y=1
}
const toRoom=v=>v.sub(route.endPos).applyAxisAngle(UP,-route.endHeading)
function start(){progress.swords.clear();progress.stages.clear();elapsed=retries=score=embers=0;showScore();load('depths');play()}
function title(){start();set('title');panel('From Hell<br><i>to Heaven</i>','Survive the ascent. Defeat the guardian. Reclaim the fallen sword.\nRun · A/D to steer, Space to jump\nFight · WASD to move, J to strike, K to dodge\nEsc to pause',[['Start Ascent',start]])}
function encounter(){
  track.visible=sky.visible=false;room.visible=true;loot.visible=false
  boss.position.set(0,0,-2);boss.rotation.set(0,0,0);boss.visible=boss.userData.weapon.visible=true
  player.position.set(0,0,6);player.rotation.set(0,0,0);player.scale.set(1,1,1);player.visible=true
  boss.userData.weapon.rotation.set(0,0,0)
  doors.door.position.y=2.5;doors.entry.position.y=-2
  combat?.dispose();combat=new Combat(room,player,boss,cfg);set('intro')
}
function ascent(){room.visible=false;sky.visible=true;player.position.set(0,0,0);player.rotation.set(0,0,0);set('heaven')}
function pause(){
  prior={state,age};set('pause')
  panel('Paused','The ascent can wait.',[['Resume',resume],['Restart section',()=>{
    play()
    if(['run','fall'].includes(prior.state)){restartStage();set('run')}
    else if(prior.state==='heaven')ascent()
    else{progress.swords.delete(cfg.sword);encounter()}
  }],['Return to title',title]])
}
function resume(){play();set(prior.state);age=prior.age}
function bars(label,objective,meters,tip){
  $('#label').textContent=label;$('#objective').textContent=objective
  if($('#meters').innerHTML!==meters)$('#meters').innerHTML=meters
  hint.textContent=tip
}
const meter=(label,value)=>'<label>'+label+'<progress max="100" value="'+Math.round(value)+'"></progress></label>'
function run(dt){
  strafe=T.MathUtils.damp(strafe,axis('right','left')*12,18,dt)
  lat=T.MathUtils.clamp(lat+strafe*dt,-4,4)
  jumpBuffer=pressed.has('jump')?JUMP_BUFFER:Math.max(0,jumpBuffer-dt) // a press just before landing still jumps
  if(jumpBuffer>0 && height===0){vertical=JUMP;jumpBuffer=0}
  const airborne=height>0
  vertical-=(vertical>0?RISE_GRAVITY:FALL_GRAVITY)*dt;height=Math.max(0,height+vertical*dt);if(!height)vertical=0
  if(airborne && !height)squash=1
  squash=Math.max(0,squash-dt*6);player.scale.set(1+.12*squash,1-.2*squash+(vertical>0?.06:0),1+.12*squash)
  if(ready>0)ready-=dt
  else{
    surge=Math.min(1,surge+dt/RESPAWN_RAMP)
    runPace=Math.min(1,dist/route.end)*surge
    dist+=dt*(cfg.speed+((cfg.topSpeed??cfg.speed)-cfg.speed)*runPace)
  }
  place()
  if(dist>best){score+=Math.floor(dist)-Math.floor(best);best=dist;showScore()}
  for(const e of route.pickups){
    if(e.taken)continue
    e.mesh.rotation.y+=dt*3
    if(Math.abs(dist-e.d)<.9 && Math.abs(lat-e.x)<1.1 && Math.abs(height+1-e.y)<1.4){
      e.taken=true;e.mesh.visible=false;pending.push(e);embers++;score+=cfg.embers.value;showScore(true)
    }
  }
  for(const h of route.hazards){
    const rel=dist-h.d,cycle=(clock+h.d)%3.5,near=Math.abs(rel)
    if(h.type==='fire'){
      const size=cycle>2.2?2.6:cycle>1.5?.33:.06
      h.mesh.scale.y=size;h.mesh.position.y=size/2+.1
    }
    if(h.type==='pendulum'){h.angle=.9*Math.sin(clock*2.4+h.d);h.mesh.rotation.z=h.angle}
    if((h.type==='gap' && rel>.35 && rel<2.65 && !height) ||
      (h.type==='rocks' && near<1.2 && Math.abs(lat-h.x)<2.1) ||
      (h.type==='fire' && cycle>2.2 && near<1.2 && Math.abs(lat-h.x)<2.1) ||
      (h.type==='hurdle' && near<.5 && height<1) ||
      (h.type==='gate' && near<.7 && Math.abs(lat-h.x)>1) ||
      (h.type==='pendulum' && near<1 && Math.hypot(lat-h.arm*Math.sin(h.angle),height+1-(h.pivotY-h.arm*Math.cos(h.angle)))<1.15)){
      die();return
    }
  }
  const cp=route.checkpoint(dist);if(cp!==checkpoint){checkpoint=cp;pending=[]} // embers are banked at each checkpoint
  bars(cfg.name,'Reach the gate','',ready>0?'Get ready…':dist<45?'A / D to steer   ·   Space to jump':'')
  if(dist>=route.end){toRoom(camera.position);toRoom(aim);encounter()}
}
function dungeon(dt){
  if(state==='intro'){
    doors.entry.position.y=Math.min(2,-2+age*2)
    bars('Guardian chamber',cfg.guardian,'','WASD to move   ·   J / click to strike   ·   K / Shift to dodge')
    if(age>3.6)set('combat')
  }else if(state==='combat'){
    combat.update(dt)
    bars(cfg.guardian,'Guardian chamber',meter('Vitality',combat.hp)+meter('Guardian',100*combat.bossHp/cfg.hp)+meter('Dodge',100*(1-combat.cooldown)),combat.phase==='wind'?(combat.key==='slam'?'Ground slam — clear the circle':'Heavy swing — dodge'):'')
    if(!combat.bossHp){player.visible=true;score+=500;showScore(true);set('collapse')}
    else if(!combat.hp){retries++;set('defeat');hint.textContent='You fell · Restarting the encounter'}
  }else if(state==='defeat'){if(age>1.4)encounter()}
  else if(state==='collapse'){
    boss.rotation.z=Math.min(1.5,age*1.5)
    if(age>1.1){boss.userData.weapon.visible=false;loot.position.copy(boss.position);loot.position.y=1;loot.visible=true;set('reward')}
  }else{
    combat.move(dt,false);loot.rotation.y+=dt*2
    const near=player.position.distanceTo(loot.position)<3
    if(state==='reward'){
      bars('Guardian defeated',cfg.sword,'',near?'E · Reclaim the fallen sword':'Approach the golden blade')
      if(near && pressed.has('claim')){progress.swords.add(cfg.sword);loot.visible=false;set('exit')}
    }else{
      doors.door.position.y=Math.min(8,2.5+age*3)
      bars('Sword reclaimed',cfg.sword,'','Walk through the open arch')
      if(Math.abs(player.position.x)<2.5 && player.position.z<-7.8 && age>1){
        progress.stages.add(stageId);if(cfg.next)load(cfg.next);else ascent()
      }
    }
  }
}
function update(dt){
  if(pressed.has('pause')){
    if(state==='pause')resume();else if(!['title','victory'].includes(state))pause()
    return
  }
  if(['title','victory','pause'].includes(state))return
  age+=dt;elapsed+=dt;clock+=dt
  if(state==='run')run(dt)
  else if(state==='fall'){player.position.y-=dt*2;if(age>.7){resetRunner(true);set('run')}}
  else if(state==='heaven'){
    player.position.z-=dt*4
    scene.background.lerp(new T.Color(0xb6deee),1-Math.exp(-dt));scene.fog.color.copy(scene.background)
    bars('The last ascent','Follow the light','',age<4?'The way is open':'')
    if(-player.position.z>=99){
      set('victory');panel('You Reached<br><i>Heaven</i>',[...progress.swords].join(' · ')+'\n'+'Score '+score+' · '+embers+' embers\n'+Math.floor(elapsed/60)+'m '+Math.floor(elapsed%60)+'s   ·   '+retries+' retries',[['Restart',start],['Return to title',title]])
    }
  }else dungeon(dt)
}
function frameCamera(dt){
  const p=player.position
  if(room.visible){
    eye.set(14,19,14);focus.set(0,0,0)
    if(state==='collapse'){focus.copy(boss.position);eye.multiplyScalar(.8)}
    const aspectScale=Math.max(1,1.35/camera.aspect);eye.multiplyScalar(aspectScale)
  }else{
    if(state==='title'){eye.set(6,5,7);focus.set(0,1,-10)}
    else if(track.visible)runnerView(eye,focus)
    else{eye.set(p.x*.45,4.8+p.y*.15,p.z+8);focus.set(p.x*.3,1,p.z-5)}
  }
  const k=1-Math.exp(-dt*(state==='intro'?1.4:7))
  camera.position.lerp(eye,k);aim.lerp(focus,k);camera.lookAt(aim)
}
function updatePlayerAnimation(dt){
  if(state==='pause')return
  if(state==='run')animatePlayer(dt,height>0?'jump':ready>0?'idle':'run',runPace)
  else if(state==='fall')animatePlayer(dt,'fall')
  else if(state==='heaven')animatePlayer(dt,'walk')
  else if(state==='defeat')animatePlayer(dt,'defeat',Math.min(age*2,.5))
  else if(state==='combat' && combat.dash>0)animatePlayer(dt,'dodge',1-combat.dash/.28)
  else if(state==='combat' && combat.attack>0)animatePlayer(dt,'attack',1-combat.attack/.56)
  else if((state==='combat'||state==='reward'||state==='exit') && combat.moving)animatePlayer(dt,'walk')
  else animatePlayer(dt,'idle')
}
Promise.all([rocksReady,pillarsReady]).then(()=>{
  title();let prev=performance.now()
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.05,Math.max(0,(now-prev)/1000));prev=now
    update(dt);updatePlayerAnimation(dt);if(state!=='pause')frameCamera(dt);pressed.clear();renderer.render(scene,camera)
  })
  window.addEventListener('blur',()=>{held.clear();if(!['title','victory','pause'].includes(state))pause()})
})
