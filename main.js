import * as T from 'three'
import {actor,runner,arena,heaven,sword,greatsword,rapier,forward} from './world.js'
import {Combat,DEFAULT_COMBO,DEFAULT_DASH_STRIKE,DEFAULT_SPECIAL,equipWeaponMesh} from './combat.js'
import {animateCharacter} from './character.js'
import {animateWarden,wardensReady} from './warden-models.js'
import {rocksReady} from './rocks.js'
import {pillarsReady} from './pillars.js'
import {attachWeaponModel,replaceWeaponModel,weaponsReady} from './weapon-models.js'
import {hedgesReady} from './hedges.js'
import {forestReady,forestSky,updateForestWater} from './forest.js'
import {stages,generateRoute} from './stage.js'
import {axis,pressed,held} from './input.js'
import {playCutscene} from './cutscene.js'
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
const player=actor(scene), hellBoss=actor(room,true), earthBoss=actor(room,true), otherBoss=actor(room,true), loot=new T.Group()
const bosses={hell:hellBoss,earth:earthBoss}
let boss=hellBoss
const animatePlayer=animateCharacter(player)
const preview=import.meta.env.DEV?new URLSearchParams(location.search).get('preview'):null
const previewBossStage=preview==='hell-boss'?'hell':preview==='middle-earth-boss'?'middleEarth':null

// --- WEAPON CATALOG ADAPTER (Teammate's weapons.js plugs in via registerWeapons) ---
let weaponCatalog=[
  {
    id:'ember_blade',name:'Ember Blade',unlockType:'starter',price:0,
    desc:'Balanced celestial blade.',
    combo:DEFAULT_COMBO,dashStrike:DEFAULT_DASH_STRIKE,
    special:DEFAULT_SPECIAL,
    createMesh:parent=>{
      if(!attachWeaponModel(parent,'ember'))sword(parent,0,0,0)
    }
  },
  {
    id:'cinder_greatsword',name:'Cinder Greatsword',unlockType:'box',price:0,
    desc:'Lucky Box drop · Wide cleave & heavy stagger.',
    combo:[
      {anim:'attack_1',dur:.52,dmg:16,range:3.5,arc:0,winStart:.16,winEnd:.38,step:4.0,kb:6.0,stop:.06,shake:.26},
      {anim:'attack_2',dur:.54,dmg:20,range:3.6,arc:-.1,winStart:.16,winEnd:.40,step:4.5,kb:7.5,stop:.065,shake:.30},
      {anim:'attack_3',dur:.68,dmg:30,range:4.1,arc:-.35,winStart:.22,winEnd:.48,step:7.0,kb:18.0,stop:.10,shake:.50}
    ],
    dashStrike:{anim:'dash_strike',dur:.44,dmg:22,range:4.1,arc:.05,winStart:.08,winEnd:.34,step:8.5,kb:11.0,stop:.075,shake:.35},
    special:{anim:'special_slam',dur:.68,dmg:36,range:4.6,arc:-1.1,winStart:.26,winEnd:.52,step:6.5,kb:22.0,stop:.11,shake:.55,cd:2.4,deflect:true},
    createMesh:parent=>greatsword(parent,0,0,0)
  },
  {
    id:'seraph_rapier',name:'Seraph Rapier',unlockType:'shop',price:250,
    desc:'Shop exclusive · Rapid thrusts & lethal dash-strike.',
    combo:[
      {anim:'attack_1',dur:.30,dmg:8,range:3.3,arc:.35,winStart:.08,winEnd:.22,step:5.5,kb:2.0,stop:.03,shake:.12},
      {anim:'attack_2',dur:.30,dmg:9,range:3.4,arc:.35,winStart:.08,winEnd:.22,step:6.0,kb:2.5,stop:.03,shake:.14},
      {anim:'attack_3',dur:.42,dmg:16,range:3.8,arc:.2,winStart:.12,winEnd:.30,step:9.5,kb:10.0,stop:.06,shake:.30}
    ],
    dashStrike:{anim:'dash_strike',dur:.30,dmg:20,range:4.4,arc:.3,winStart:.04,winEnd:.24,step:11.5,kb:8.0,stop:.065,shake:.32},
    special:{anim:'special_thrust',dur:.44,dmg:28,range:5.0,arc:.35,winStart:.08,winEnd:.34,step:14.0,kb:13.0,stop:.08,shake:.38,cd:1.8,deflect:true},
    createMesh:parent=>rapier(parent,0,0,0)
  }
]
export function registerWeapons(customList){
  if(Array.isArray(customList) && customList.length){
    weaponCatalog=customList
    const starter=weaponCatalog.find(w=>w.unlockType==='starter')??weaponCatalog[0]
    if(starter && !progress.weapons.has(starter.id)){
      progress.weapons.add(starter.id)
      progress.equipped=starter.id
    }
    renderArsenal()
  }
}
window.registerWeapons=registerWeapons
const guardianWeapons=new Map(Object.values(stages).filter(stage=>stage.rewardWeapon).map(stage=>[
  stage.rewardWeapon,{
    id:stage.rewardWeapon,name:stage.sword,
    createMesh:parent=>{
      if(!attachWeaponModel(parent,stage.rewardWeapon))sword(parent)
    }
  }
]))
const getWeapon=id=>guardianWeapons.get(id)??weaponCatalog.find(w=>w.id===id)??weaponCatalog[0]
const earnedGuardianWeapons=()=>[...guardianWeapons.values()].filter(w=>progress.weapons.has(w.id))

// --- DYNAMIC ARSENAL & SHOP DOM ---
const arsenalEl=document.createElement('section')
arsenalEl.id='arsenal';arsenalEl.hidden=true
arsenalEl.innerHTML='<div id="slots"></div><div id="lockout"></div><div id="potion-bar"><span id="potions"></span><span id="maxhp-tag"></span></div>'
document.body.append(arsenalEl)

const shopEl=document.createElement('section')
shopEl.id='shop';shopEl.hidden=true
shopEl.innerHTML='<div class="shop-card"><h2>Ember Merchant</h2><div class="shop-sub" id="shop-embers"></div><div class="shop-grid" id="shop-items"></div><button id="shop-close">Continue Ascent</button></div>'
document.body.append(shopEl)

let state,prior,cfg,route,doors,combat,age,elapsed,retries,checkpoint,vertical,strafe,clock,stageId,dist,lat,height,ready=0,surge=1,jumpBuffer=0,squash=0,best=0
let pending=[],pendingBoxes=[],stageScore=0,stageEmbers=0,score=0,embers=0,bannerTimer=0
const MAX_POTIONS=3
const progress={
  swords:new Set(),
  stages:new Set(),
  weapons:new Set(['ember_blade']),
  equipped:'ember_blade',
  entryWeapon:'ember_blade',
  potions:1,
  maxHp:100,
  entryPotions:1
}

const aim=new T.Vector3(),eye=new T.Vector3(),focus=new T.Vector3(),dir=new T.Vector3(),UP=new T.Vector3(0,1,0)
function set(s){state=s;age=0;hint.textContent='';pressed.clear();renderArsenal()}
function panel(title,copy,actions){
  menu.hidden=false;hud.hidden=$('#score').hidden=arsenalEl.hidden=true;shopEl.hidden=true;hint.textContent=''
  $('h1').innerHTML=title;$('#copy').textContent=copy;$('#buttons').replaceChildren()
  for(const [name,fn] of actions){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{b.blur();fn()};$('#buttons').append(b)}
}
function play(){menu.hidden=true;hud.hidden=$('#score').hidden=false;renderArsenal()}

function renderArsenal(){
  const show=!menu.hidden?false:['combat','reward','exit','shop'].includes(state)
  arsenalEl.hidden=!show
  if(!show)return
  const slotsEl=$('#slots')
  const slots=weaponCatalog.map((w,i)=>{
    const unlocked=progress.weapons.has(w.id)
    const active=progress.equipped===w.id
    const cls=active?'slot active':unlocked?'slot unlocked':'slot locked'
    const label=unlocked?`[${i+1}] ${w.name}`:`[${i+1}] ??? (${w.unlockType==='shop'?'Shop':'Box'})`
    return `<span class="${cls}">${label}</span>`
  })
  for(const w of earnedGuardianWeapons()){
    slots.push(`<span class="slot ${progress.equipped===w.id?'active':'unlocked'}">[Q] ${w.name}</span>`)
  }
  slotsEl.innerHTML=slots.join('')
  const lockEl=$('#lockout')
  if(combat && !combat.canSwitch){
    lockEl.textContent=combat.switchLockout>0?`Weapon switch locked (${combat.switchLockout.toFixed(1)}s)`:'Cannot switch mid-move'
  }else{
    lockEl.textContent='[1-3 / Q] Switch Weapon'
  }
  $('#potions').textContent=`[R] Potions: ${progress.potions} / ${MAX_POTIONS}`
  $('#maxhp-tag').textContent=`Max HP: ${progress.maxHp}`
}

function openShop(){
  set('shop')
  shopEl.hidden=false
  renderShop()
}
function closeShop(){
  shopEl.hidden=true
  set('exit')
}
$('#shop-close').onclick=e=>{e.stopPropagation();$('#shop-close').blur();closeShop()}

function renderShop(){
  $('#shop-embers').textContent=`Available Embers: ✦ ${embers}  ·  Current HP: ${Math.round(combat.hp)} / ${progress.maxHp}`
  const grid=$('#shop-items')
  grid.replaceChildren()

  const addRow=(title,desc,btnText,disabled,onBuy)=>{
    const row=document.createElement('div');row.className='shop-item'
    row.innerHTML=`<div><b>${title}</b><small>${desc}</small></div>`
    const btn=document.createElement('button');btn.textContent=btnText;btn.disabled=disabled
    btn.onclick=e=>{e.stopPropagation();btn.blur();onBuy();showScore(true);renderArsenal();renderShop()}
    row.append(btn);grid.append(row)
  }

  const fullPotions=progress.potions>=MAX_POTIONS
  addRow(
    `Crimson Draught (${progress.potions}/${MAX_POTIONS})`,
    'Restores +40 HP during combat when pressing R or F.',
    fullPotions?'Maxed':'100 ✦',
    fullPotions || embers<100,
    ()=>{embers-=100;progress.potions++}
  )

  addRow(
    'Vitality Elixir (+20 Max HP)',
    'Permanently increases Max Vitality for this run and heals to full.',
    '150 ✦',
    embers<150,
    ()=>{embers-=150;progress.maxHp+=20;combat.maxHp=progress.maxHp;combat.hp=progress.maxHp}
  )

  for(const w of weaponCatalog){
    if(w.unlockType!=='shop')continue
    const owned=progress.weapons.has(w.id)
    addRow(
      w.name,
      w.desc||'Direct-purchase arsenal weapon.',
      owned?'Unlocked':`${w.price} ✦`,
      owned || embers<w.price,
      ()=>{
        embers-=w.price
        progress.weapons.add(w.id)
        progress.equipped=w.id
        combat.setWeapon(w,false)
      }
    )
  }
}

function load(id){
  combat?.dispose();track.clear();room.clear()
  stageId=id;cfg=stages[id]
  progress.entryWeapon=progress.equipped
  boss=bosses[cfg.wardenModels]??otherBoss
  loot.clear()
  loot.rotation.set(0,0,0)
  loot.visible=false
  if(!cfg.rewardWeapon||!attachWeaponModel(loot,cfg.rewardWeapon,1.2))sword(loot)
  room.add(boss,loot)
  route=runner(track,cfg,generateRoute(cfg));doors=arena(room,cfg)
  scene.background=cfg.forest?forestSky():new T.Color(cfg.sky)
  scene.fog=new T.FogExp2(cfg.sky,cfg.forest?.025:.017)
  light.color.setHex(cfg.forest?0xf0ebc9:0xffe8ce)
  light.groundColor.setHex(cfg.forest?0x60744c:0xbc7773)
  light.intensity=cfg.forest?1.65:2.1
  sun.color.setHex(cfg.forest?0xf7e8ad:0xffdcba)
  sun.intensity=cfg.forest?2.05:2.5
  stageScore=score;stageEmbers=embers;checkpoint=clock=best=0;resetRunner();set('run')
}
const JUMP=13, RISE_GRAVITY=38, FALL_GRAVITY=52, JUMP_BUFFER=.15
const RESPAWN_PAUSE=.6, RESPAWN_RAMP=1.4
let runPace=0
function resetRunner(respawn=false){
  track.visible=true;room.visible=sky.visible=false;player.visible=true
  dist=checkpoint;lat=height=vertical=strafe=squash=jumpBuffer=0;player.scale.set(1,1,1)
  ready=respawn?RESPAWN_PAUSE:0;surge=respawn?0:1;runPace=0;pending=[];pendingBoxes=[]
  place();runnerView(camera.position,aim)
}
function restartStage(){
  score=stageScore;embers=stageEmbers;best=checkpoint=0;showScore()
  for(const e of route.pickups){e.taken=false;e.mesh.visible=true}
  for(const b of route.boxes){b.taken=false;b.mesh.visible=true}
  resetRunner()
}
function showScore(pop=false){
  $('#points').textContent=score;$('#embers').textContent='✦ '+embers
  if(pop){const el=$('#points');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
}
function die(){
  for(const e of pending){e.taken=false;e.mesh.visible=true;embers--;score-=cfg.embers.value}
  for(const b of pendingBoxes){
    b.taken=false;b.mesh.visible=true
    if(b.unlockedId)progress.weapons.delete(b.unlockedId)
  }
  pending=[];pendingBoxes=[];showScore();retries++;set('fall');hint.textContent='Returning to checkpoint'
}
function place(){const h=route.at(dist,lat,player.position);player.position.y=height;player.rotation.set(0,h,-strafe*.015)}
function runnerView(eyeOut,focusOut){
  const h=route.at(dist,lat*.45,eyeOut);eyeOut.addScaledVector(forward(h,dir),-8);eyeOut.y=4.8+height*.15
  route.at(dist,lat*.3,focusOut);focusOut.addScaledVector(dir,5);focusOut.y=1
}
const toRoom=v=>v.sub(route.endPos).applyAxisAngle(UP,-route.endHeading)
function start(id='hell'){
  const starter=weaponCatalog.find(w=>w.unlockType==='starter')??weaponCatalog[0]
  progress.swords.clear();progress.stages.clear()
  progress.weapons=new Set([starter.id]);progress.equipped=starter.id
  equipWeaponMesh(player,starter)
  progress.potions=1;progress.maxHp=100;progress.entryPotions=1
  elapsed=retries=score=embers=0;showScore();load(id);play()
}
function title(){
  start();set('title')
  panel(
    'From Hell<br><i>to Heaven</i>',
    'Survive the ascent. Collect Embers & Lucky Boxes. Conquer the chamber.\nRun · A/D to steer, Space to jump\nFight · WASD move, LMB/J strike, RMB/I special, Space/K dodge, 1-3/Q weapon, R potion',
    [['Start Ascent',intro],['Skip to Dungeon 1',()=>{start();embers=250;showScore();encounter()}]]
  )
}
// Opening cutscene (script lives in dialogue.js), then the run begins.
function intro(){menu.hidden=true;playCutscene(()=>start())}
function encounter(){
  track.visible=sky.visible=false;room.visible=true;loot.visible=false;shopEl.hidden=true
  boss.position.set(0,0,-2);boss.rotation.set(0,0,0);boss.visible=boss.userData.weapon.visible=true
  player.position.set(0,0,6);player.rotation.set(0,0,0);player.scale.set(1,1,1);player.visible=true
  boss.userData.weapon.rotation.set(0,0,0)
  doors.door.position.y=2.5;doors.entry.position.y=-2;doors.stall.visible=false
  progress.entryPotions=progress.potions
  combat?.dispose();combat=new Combat(room,player,boss,cfg,progress.maxHp,getWeapon(progress.equipped));set('intro')
  if(previewBossStage===stageId){
    const bossWave=cfg.waves.findIndex(wave=>wave.boss)
    if(bossWave>=0){
      combat.waves.index=bossWave-1
      combat.waves.startNextWave(combat.enemies)
      set('combat')
    }
  }
}
function ascent(){room.visible=false;sky.visible=true;player.position.set(0,0,0);player.rotation.set(0,0,0);set('heaven')}
function pause(){
  if(state==='shop')closeShop()
  prior={state,age};set('pause')
  panel('Paused','The ascent can wait.',[['Resume',resume],['Restart section',()=>{
    play()
    if(['run','fall'].includes(prior.state)){restartStage();set('run')}
    else if(prior.state==='heaven')ascent()
    else{
      progress.swords.delete(cfg.sword)
      if(cfg.rewardWeapon){
        progress.weapons.delete(cfg.rewardWeapon)
        if(progress.equipped===cfg.rewardWeapon)progress.equipped=progress.entryWeapon
      }
      progress.potions=progress.entryPotions
      encounter()
    }
  }],['Return to title',title]])
}
function resume(){play();set(prior.state);age=prior.age}
function bars(label,objective,meters,tip){
  $('#label').textContent=label;$('#objective').textContent=objective
  if($('#meters').innerHTML!==meters)$('#meters').innerHTML=meters
  hint.textContent=tip
}
const meter=(label,value,detail='',tone='vitality')=>{
  const pct=Math.max(0,Math.min(100,Math.round(value)))
  return `<div class="meter meter-${tone}"><div class="meter-head"><span>${label}</span><b>${detail}</b></div><div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div></div>`
}
function handleDungeonHotkeys(){
  if(!combat)return
  if(pressed.has('potion')){
    if(progress.potions>0 && combat.hp<progress.maxHp && combat.potionCooldown<=0){
      progress.potions--
      combat.heal(40)
      bannerTimer=1.6
      hint.textContent='Used Crimson Draught (+40 HP)'
    }
  }
  let targetId=null
  if(pressed.has('slot1'))targetId=weaponCatalog[0]?.id
  else if(pressed.has('slot2'))targetId=weaponCatalog[1]?.id
  else if(pressed.has('slot3'))targetId=weaponCatalog[2]?.id
  else if(pressed.has('cycleWeapon')){
    const unlocked=[...weaponCatalog.filter(w=>progress.weapons.has(w.id)),...earnedGuardianWeapons()]
    if(unlocked.length>1){
      const idx=unlocked.findIndex(w=>w.id===progress.equipped)
      targetId=unlocked[(idx+1)%unlocked.length].id
    }
  }
  if(targetId && targetId!==progress.equipped){
    if(!progress.weapons.has(targetId)){
      bannerTimer=1.4;hint.textContent='Weapon still locked!'
    }else if(!combat.canSwitch){
      bannerTimer=1.4;hint.textContent=`Switch locked for ${combat.switchLockout.toFixed(1)}s after move`
    }else{
      progress.equipped=targetId
      const w=getWeapon(targetId)
      combat.setWeapon(w,true)
      bannerTimer=1.4;hint.textContent=`Equipped: ${w.name}`
    }
  }
}

// Damage popups: the red_nacho icon and the damage number rise from where an enemy was hit, then fade.
const popupLayer=$('#popups'),popupPos=new T.Vector3()
function showHits(hits){
  for(const h of hits){
    popupPos.set(h.x,h.y,h.z).project(camera)
    if(popupPos.z>1)continue // behind the camera
    const el=document.createElement('div');el.className='hit-pop'+(h.heavy?' heavy':'')
    el.style.left=((popupPos.x+1)/2*innerWidth+(Math.random()*24-12))+'px'
    el.style.top=((1-popupPos.y)/2*innerHeight+(Math.random()*10-5))+'px'
    el.innerHTML='<img src="./sprites/red_nacho.png" alt=""><b>'+h.dmg+'</b>'
    popupLayer.append(el);el.addEventListener('animationend',()=>el.remove())
  }
}
// Runner progress bar: the red fill inside finish_line.png grows smoothly from dark to bright red.
const progressBar=$('#progress'),progressFill=$('#progress .fill')
let barShown=false,barFill=-1
function showProgress(on){if(on!==barShown){barShown=on;progressBar.hidden=$('#controls').hidden=!on}} // bar and controls panel
function drawProgress(fraction){
  const f=Math.round(Math.min(1,Math.max(0,fraction))*1000)/10;if(f===barFill)return;barFill=f
  progressFill.style.backgroundSize=f+'% 100%'
}
function run(dt){
  strafe=T.MathUtils.damp(strafe,axis('right','left')*12,18,dt)
  lat=T.MathUtils.clamp(lat+strafe*dt,-4,4)
  jumpBuffer=pressed.has('jump')?JUMP_BUFFER:Math.max(0,jumpBuffer-dt)
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

  for(const b of route.boxes){
    if(b.taken)continue
    b.mesh.rotation.y+=dt*2.4;b.mesh.rotation.x+=dt*1.3
    if(Math.abs(dist-b.d)<1.05 && Math.abs(lat-b.x)<1.25 && Math.abs(height+1-b.y)<1.5){
      b.taken=true;b.mesh.visible=false
      const lockedBoxWeapons=weaponCatalog.filter(w=>w.unlockType==='box' && !progress.weapons.has(w.id))
      if(lockedBoxWeapons.length){
        const pick=lockedBoxWeapons[Math.floor(Math.random()*lockedBoxWeapons.length)]
        progress.weapons.add(pick.id)
        b.unlockedId=pick.id
        bannerTimer=2.8
        hint.textContent=`Lucky Box! Unlocked: ${pick.name}`
      }else{
        embers+=150;score+=300;showScore(true)
        bannerTimer=2.2
        hint.textContent='Lucky Box! +150 Embers Bonus'
      }
      pendingBoxes.push(b)
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
  const cp=route.checkpoint(dist);if(cp!==checkpoint){checkpoint=cp;pending=[];pendingBoxes=[]}
  drawProgress(dist/route.end)
  const defaultTip=ready>0?'Get ready…':dist<45?'Hit Lucky Boxes for weapons':''
  bars(cfg.name,cfg.placeholder?'Placeholder Runner Section':'Reach the gate','',bannerTimer>0?hint.textContent:defaultTip)
  if(dist>=route.end){toRoom(camera.position);toRoom(aim);encounter()}
}

function dropGuardianSword(){
  if(loot.visible)return
  boss.userData.weapon.visible=false
  loot.position.copy(boss.position)
  loot.position.y=1
  loot.visible=true
}

function dungeon(dt){
  if(state==='shop'){
    doors.stall.userData.orb.rotation.y+=dt*2
    return
  }
  handleDungeonHotkeys()
  renderArsenal()

  if(state==='intro'){
    doors.entry.position.y=Math.min(2,-2+age*2)
    bars(cfg.name,'Survive the waves','',bannerTimer>0?hint.textContent:'WASD move · LMB/J strike · RMB/I special · Space/K dodge · 1-3/Q weapon · R potion')
    if(age>3.6)set('combat')
  }else if(state==='combat'){
    combat.update(dt)
    showHits(combat.hits);combat.hits.length=0
    if(cfg.wardenModels==='earth' && combat.waves.bossActive && combat.bossHp===0){
      dropGuardianSword()
      loot.rotation.y+=dt*2
    }
    const aliveMobs=combat.enemies.filter(e=>e.alive).length
    const titleLabel=combat.waves.bossActive?cfg.guardian:`Wave ${Math.max(1,combat.waves.current)} / ${combat.waves.total}`
    const hpMeter=meter('Vitality',100*combat.hp/progress.maxHp,`${Math.ceil(combat.hp)} / ${progress.maxHp}`,'vitality')
    const targetMeter=combat.waves.bossActive
      ?meter('Guardian',100*combat.bossHp/cfg.hp,`${Math.ceil(combat.bossHp)} / ${cfg.hp}`,'boss')
      :meter('Hostiles',100*Math.min(1,aliveMobs/4),`${aliveMobs} left`,'boss')
    const specialPct=100*(1-combat.specialCooldown/combat.specialMaxCd)
    const specialMeter=meter('Special [RMB]',specialPct,combat.specialReady?'Ready':`${combat.specialCooldown.toFixed(1)}s`,'dodge')
    const dodgeMeter=meter('Dodge',100*(1-combat.cooldown),combat.cooldown<=0?'Ready':`${combat.cooldown.toFixed(1)}s`,'dodge')
    const defaultTip=combat.waves.bossActive && combat.bossHp===0 && aliveMobs
      ?`Guardian down · ${aliveMobs} ${aliveMobs===1?'hostile':'hostiles'} remaining`
      :combat.waves.bossActive && combat.bossHp>0 && combat.phase==='wind'
      ?(combat.key==='slam'?'Ground slam — clear the circle':'Heavy swing — dodge')
      :(aliveMobs?`${aliveMobs} hostiles remaining`:'Next wave incoming…')
    bars(titleLabel,cfg.name,hpMeter+targetMeter+specialMeter+dodgeMeter,bannerTimer>0?hint.textContent:defaultTip)
    if(combat.cleared){player.visible=true;score+=500;showScore(true);set('collapse')}
    else if(!combat.hp){player.visible=true;retries++;progress.potions=progress.entryPotions;set('defeat');hint.textContent='You fell · Restarting the encounter'}
  }else if(state==='defeat'){if(age>1.4)encounter()}
  else if(state==='collapse'){
    if(loot.visible)loot.rotation.y+=dt*2
    if(age>1.1){dropGuardianSword();set('reward')}
  }else{
    combat.move(dt,false);loot.rotation.y+=dt*2
    const nearSword=player.position.distanceTo(loot.position)<3
    if(state==='reward'){
      bars('Guardian defeated',cfg.sword,'',nearSword?'E · Reclaim the fallen sword':'Approach the golden blade')
      if(nearSword && pressed.has('claim')){
        progress.swords.add(cfg.sword)
        const reward=guardianWeapons.get(cfg.rewardWeapon)
        if(reward){
          progress.weapons.add(reward.id)
          progress.equipped=reward.id
          combat.setWeapon(reward,false)
        }
        loot.visible=false
        doors.stall.visible=Boolean(cfg.next)
        set('exit')
      }
    }else{
      doors.door.position.y=Math.min(8,2.5+age*3)
      if(doors.stall.visible){
        doors.stall.userData.orb.rotation.y+=dt*2.5
        const nearShop=player.position.distanceTo(doors.stall.position)<3.2
        if(nearShop && pressed.has('claim')){openShop();return}
        const exitTip=nearShop?'E · Open Ember Shop (Potions & Weapons)':'Visit the Ember Merchant stall or walk through the open arch'
        bars('Chamber Cleared','Next: '+stages[cfg.next].name,'',bannerTimer>0?hint.textContent:exitTip)
      }else{
        bars('Heaven\'s Gate Opened','Final Ascent Ahead','',bannerTimer>0?hint.textContent:'Walk through the open arch to ascend to Heaven')
      }
      if(Math.abs(player.position.x)<2.5 && player.position.z<-28.5 && age>1){
        progress.stages.add(stageId);if(cfg.next)load(cfg.next);else ascent()
      }
    }
  }
}

function update(dt){
  if(bannerTimer>0)bannerTimer=Math.max(0,bannerTimer-dt)
  if(pressed.has('pause')){
    if(state==='pause')resume()
    else if(state==='shop')closeShop()
    else if(!['title','victory'].includes(state))pause()
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
  }else{
    dungeon(dt)
    if(state==='combat'||state==='defeat'||state==='collapse')combat.updateBossFall(dt)
  }
}

function frameCamera(dt){
  const p=player.position
  if(room.visible){
    const fx=T.MathUtils.clamp(p.x,-23,23), fz=T.MathUtils.clamp(p.z,-23,23)
    focus.set(fx,1.0,fz);eye.set(fx+9.5,11.5,fz+9.5)
    if(state==='collapse'){focus.set(boss.position.x,1.0,boss.position.z);eye.set(boss.position.x+7.5,9.0,boss.position.z+7.5)}
    const aspectScale=Math.max(1,1.35/camera.aspect);eye.sub(focus).multiplyScalar(aspectScale).add(focus)
  }else{
    if(state==='title'){eye.set(6,5,7);focus.set(0,1,-10)}
    else if(track.visible)runnerView(eye,focus)
    else{eye.set(p.x*.45,4.8+p.y*.15,p.z+8);focus.set(p.x*.3,1,p.z-5)}
  }
  const k=1-Math.exp(-dt*(state==='intro'?1.4:7))
  camera.position.lerp(eye,k);aim.lerp(focus,k)
  if(combat?.shake>0){
    camera.position.x+=(Math.random()-.5)*combat.shake
    camera.position.y+=(Math.random()-.5)*combat.shake
    combat.shake=Math.max(0,combat.shake-dt*2.4)
  }
  camera.lookAt(aim)
}

function updatePlayerAnimation(dt){
  if(state==='pause' || state==='shop')return
  const inCombat=['intro','combat','reward','exit'].includes(state)
  if(state==='run')animatePlayer(dt,height>0?'jump':ready>0?'idle':'run',runPace,false)
  else if(state==='fall')animatePlayer(dt,'fall',0,false)
  else if(state==='heaven')animatePlayer(dt,'walk',0,false)
  else if(state==='defeat')animatePlayer(dt,'defeat',Math.min(age*2,.5),true)
  else if(['combat','reward','exit'].includes(state) && combat){
    const {state:animState,action,speed,progress:animProg}=combat.anim
    if(animState==='dash')animatePlayer(dt,'dash',animProg,true)
    else if(animState==='attack')animatePlayer(dt,action,animProg,true)
    else if(animState==='run')animatePlayer(dt,speed>.7?'run':'walk',speed,true)
    else animatePlayer(dt,'idle',0,true)
  }else animatePlayer(dt,'idle',0,inCombat)
}

Promise.all([rocksReady,pillarsReady,wardensReady,weaponsReady,hedgesReady,forestReady]).then(()=>{
  for(const [actor,key] of [[player,'ember'],[hellBoss,'warden'],[earthBoss,'earthSword']]){
    replaceWeaponModel(actor.userData.weapon,key)
  }
  hellBoss.userData.animate=animateWarden('hell',hellBoss,2.35)
  earthBoss.userData.animate=animateWarden('earth',earthBoss,2.25)
  if(previewBossStage){start(previewBossStage);encounter()}
  else if(preview==='middle-earth')start('middleEarth')
  else title()
  let prev=performance.now()
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.05,Math.max(0,(now-prev)/1000));prev=now
    update(dt);updatePlayerAnimation(dt);showProgress(['run','fall'].includes(state));if(state!=='pause')frameCamera(dt)
    if(cfg.forest)updateForestWater(clock)
    pressed.clear();renderer.render(scene,camera)
  })
  window.addEventListener('blur',()=>{held.clear();if(!['title','victory','pause'].includes(state))pause()})
})
