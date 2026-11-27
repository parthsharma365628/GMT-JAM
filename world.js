import {lavaJet,goldenGate} from './lava-vents.js'
import * as T from 'three'
import {volcanicRock} from './rocks.js'
import {fingerPillar} from './pillars.js'
import {hedge} from './hedges.js'
import {forestTree,forestWater} from './forest.js'
import {celestialCloud,celestialCloudDeck,celestialPillar} from './celestial.js'
import {infernalLava,infernalShrine} from './inferno.js'
import {marbleFloor,realmFloor,redCarpet} from './terrain.js'
import {pendulum} from './pendulum.js'
import {sweeper,slider,boulder} from './runner-obstacles.js'
import {glowHazards} from './hazard-glow.js'
import {addArenaInlay} from './arena-inlays.js'
import {luckyChest,luckyChestColor} from './lucky-chests.js'
import {emberCoin} from './ember-coins.js'
const cube = new T.BoxGeometry()
const materials = new Map()
export function box(parent,x,y,z,w,h,d,color) {
  if (!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,flatShading:true}))
  const mesh = new T.Mesh(cube,materials.get(color))
  mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh)
  return mesh
}
export function sword(parent,x=0,y=0,z=0,bladeColor=0xffde94,guardColor=0xffa23c) {
  const g=new T.Group(); parent.add(g); g.position.set(x,y,z)
  box(g,0,.6,0,.17,1.2,.13,bladeColor); box(g,0,0,0,.65,.12,.15,guardColor)
  box(g,0,-.21,0,.12,.35,.12,0x713c30); return g
}
export function greatsword(parent,x=0,y=0,z=0) {
  const g=new T.Group(); parent.add(g); g.position.set(x,y,z)
  box(g,0,.78,0,.28,1.55,.16,0xff7a3d); box(g,0,.78,0,.12,1.45,.2,0xffd27d)
  box(g,0,0,0,.85,.16,.2,0x4a2525); box(g,0,-.26,0,.14,.45,.14,0x2e1a1a)
  return g
}
export function rapier(parent,x=0,y=0,z=0) {
  const g=new T.Group(); parent.add(g); g.position.set(x,y,z)
  box(g,0,.72,0,.09,1.45,.09,0x9be8ff); box(g,0,.04,0,.44,.22,.44,0xffd76b)
  box(g,0,-.2,0,.1,.34,.1,0x3c2c42); return g
}
export function actor(parent,boss=false) {
  const g=new T.Group(); parent.add(g)
  box(g,0,.8,0,.8,1.2,.55,boss?0x73332d:0x45939a)
  box(g,0,1.67,0,.57,.56,.55,boss?0x2c2630:0xe7d2ad)
  box(g,0,1.65,-.29,.44,.11,.06,boss?0xff5726:0x243749)
  for(const side of [-1,1]){
    box(g,side*.26,.17,0,.32,.34,.42,0x332b37)
    box(g,side*.45,1.25,0,.38,.35,.55,boss?0xaf6546:0xccc0a1)
    if(boss) box(g,side*.25,2,0,.15,.5,.16,0xe6b080).rotation.z=-side*.35
  }
  const mount=new T.Group()
  mount.position.set(.57,.85,-.23)
  g.add(mount)
  sword(mount,0,0,0)
  g.userData.weapon=mount
  if(boss) g.scale.setScalar(1.85)
  return g
}
const sideX={left:-1.8,center:0,right:1.8}, gateX={left:-2.5,center:0,right:2.5}
const gemGeo=new T.OctahedronGeometry(.34), gemMat=new T.MeshStandardMaterial({color:0xffd75e,emissive:0xff8a1c,emissiveIntensity:.7,flatShading:true})
const TURN_RADIUS=6, tmpA=new T.Vector3(), tmpB=new T.Vector3()
export const forward=(h,v=new T.Vector3())=>v.set(-Math.sin(h),0,-Math.cos(h))
const rightOf=(h,v=new T.Vector3())=>v.set(Math.cos(h),0,-Math.sin(h))
function sample(p,s,lat,out){
  if(p.kind==='straight'){
    out.copy(p.p0).addScaledVector(forward(p.h0,tmpA),s).addScaledVector(rightOf(p.h0,tmpB),lat)
    return p.h0
  }
  const sg=Math.sign(p.turn),h=p.h0+sg*s/TURN_RADIUS
  out.copy(p.p0).addScaledVector(rightOf(p.h0,tmpA),-sg*TURN_RADIUS).addScaledVector(rightOf(h,tmpB),sg*TURN_RADIUS+lat)
  return h
}
function layout(cfg,route){
  const turns=new Map();let after=0
  for(const t of cfg.turns??[]){after+=t.after;turns.set(after,(turns.get(after)??0)-t.angle*Math.PI/180)}
  const pieces=[],pos=new T.Vector3();let h=0,d=0
  const add=piece=>{pieces.push(piece);d+=piece.length;h=sample(piece,piece.length,0,pos)}
  route.forEach((seg,i)=>{
    add({kind:'straight',seg,d0:d,length:cfg.segmentLength,p0:pos.clone(),h0:h})
    const turn=turns.get(i)
    if(turn && i<route.length-1)add({kind:'arc',d0:d,length:TURN_RADIUS*Math.abs(turn),p0:pos.clone(),h0:h,turn})
  })
  return {pieces,end:d,endPos:pos.clone(),endHeading:h}
}
const railColor=cfg=>cfg.celestial?0xd6ae6e:cfg.forest?0x816148:0xc47b54
function curve(root,p,cfg){
  const n=Math.max(2,Math.ceil(Math.abs(p.turn)/(Math.PI/36))),step=p.length/n,sg=Math.sign(p.turn),v=new T.Vector3()
  const arcDepth=lat=>(TURN_RADIUS+sg*lat)*Math.abs(p.turn)/n*1.15+.1
  for(let k=0;k<n;k++){
    const h=sample(p,(k+.5)*step,0,v)
    const ground=box(root,v.x,-.6,v.z,9,1.2,arcDepth(-sg*4.5),cfg.stone)
    ground.rotation.y=h
    ground.material=realmFloor(cfg)
    for(const s of [-1,1]){sample(p,(k+.5)*step,s*4.3,v);box(root,v.x,.07,v.z,.25,.14,arcDepth(s*4.3),railColor(cfg)).rotation.y=h}
  }
}
export function runner(root,cfg,route,{showcasePickup=null}={}){
  const hazards=[], pickups=[], boxes=[], length=cfg.segmentLength, middle=length/2
  const {pieces,end,endPos,endHeading}=layout(cfg,route)
  for(const [index,piece] of pieces.entries()){
    if(piece.kind==='arc'){curve(root,piece,cfg);continue}
    const {type,side}=piece.seg, d=piece.d0+middle, x=sideX[side]??0
    const g=new T.Group(); root.add(g); g.position.copy(piece.p0); g.rotation.y=piece.h0
    const floor=(a,b)=>{
      const ground=box(g,0,-.6,-(a+b)/2,9,1.2,b-a,cfg.stone)
      ground.material=realmFloor(cfg)
    }
    if(type==='gap'){
      floor(0,middle);floor(middle+3,length)
      box(g,0,.02,-middle+.18,9,.04,.36,0xffb54f)
      hazards.push({type,d})
    }else floor(0,length)
    if(cfg.infernal && index%8===2){
      const side=index%16===2?1:-1
      infernalShrine(g,side*17,-middle,-side*.35,1.42)
      infernalShrine(g,-side*24,-length,side*.22,1.6)
    }
    for(let k=0;k<4;k++){
      const side=k%2?1:-1
      const z=-k*length/4
      if(cfg.celestial){
        const variation=(Math.floor(piece.d0/length)+k)%5
        celestialPillar(g,side*(6.15+variation*.15),-5.4,z,2.15,8.1+variation*.6,variation*Math.PI*.32)
        celestialCloud(g,side*(9.8+variation*.8),-7.7,z-1,9.5,3.6+variation*.44,9,k%2===0,true)
        if(k<2)celestialCloud(g,side*(24+variation*2),-9,z-5,22,6,15,k%2!==0,true)
      }else if(cfg.forest){
        const seed=piece.d0*4+k
        forestTree(g,side*(7.4+k*.19),z,seed)
        forestTree(g,side*(12+(k%3)*1.34),z-2.6,seed+5,{background:true})
      }else if(!fingerPillar(g,side,z,piece.d0*4+k)){
        box(g,side*6,1,z,1.5,5+k,1.6,0x472c37).rotation.z=side*.16
      }
      box(g,side*4.3,.07,z,.25,.14,4,railColor(cfg))
    }
    if(type==='rocks'){
      const side=Math.sign(x), variant=Math.round(piece.d0)
      if(cfg.celestial){
        celestialCloud(g,x,-.06,-middle,4.1,1.82,2.17,side<0)
      }else if(cfg.hedgeObstacles){
        if(!hedge(g,x,-middle,4,1.8,2.12,side<0))box(g,x,.9,-middle,4,1.8,2.12,0x39472e)
      }else{
        volcanicRock(g,x+side*.62,-.06,-middle,2.65,1.92,2.1,variant)
        volcanicRock(g,x-side*.83,-.04,-middle+.18,2.18,1.45,1.92,variant+3)
        volcanicRock(g,x+side*1.45,-.04,-middle-.45,1.1,.72,1.18,variant+5)
      }
      hazards.push({type,d,x})
    }
    if(type==='fire'){ // timed hazard: a lava vent in Hell, a golden gate in Heaven, the plain block elsewhere
      if(cfg.infernal)hazards.push({type,d,x,jet:lavaJet(g,x,-middle)})
      else if(cfg.celestial)hazards.push({type,d,x,jet:goldenGate(g,x,-middle)})
      else{
        box(g,x,.05,-middle,4,.1,2,0xc08146)
        hazards.push({type,d,x,mesh:box(g,x,1,-middle,4,2,2,0xff631d)})
      }
    }
    if(type==='hurdle'){
      box(g,0,.55,-middle,9,1.1,.6,cfg.celestial?0xaf987a:cfg.forest?0x66513b:0x8c3b2e)
      for(let k=-4;k<=4;k++)box(g,k,1.25,-middle,.25,.3,.25,0xffb54f)
      hazards.push({type,d})
    }
    if(type==='gate'){
      const ox=gateX[side]??0
      for(const [a,b] of [[-4.5,ox-1.5],[ox+1.5,4.5]]){
        const width=b-a
        if(width<=.05)continue
        const center=(a+b)/2
        if(cfg.celestial){
          celestialCloud(g,center,-.04,-middle,width,2.44,1.38,a>ox)
        }else if(cfg.hedgeObstacles){
          if(!hedge(g,center,-middle,width,2.44,1.38,a>ox))box(g,center,1.2,-middle,width,2.4,1.38,0x39472e)
        }else{
          const variant=Math.floor(piece.d0/length)+(a>ox?1:0)
          volcanicRock(g,center,-.04,-middle,width,2.44,1.38,variant,true)
        }
      }
      hazards.push({type,d,x:ox})
    }
    if(type==='pendulum'){
      const support=cfg.celestial?0xb4a38e:cfg.forest?0x614831:0x5a4048
      for(const s of [-1,1])box(g,s*5,3.3,-middle,.6,6.6,.6,support)
      box(g,0,6.6,-middle,10.6,.5,.6,support)
      const pivot=new T.Group();g.add(pivot);pivot.position.set(0,6.3,-middle)
      box(pivot,0,-2.8,0,.15,5.6,.15,cfg.celestial?0xa78650:0x2c2630)
      const bob=new T.Group();bob.position.y=-5.6;pivot.add(bob)
      const width=cfg.celestial?2.14:cfg.forest?1.82:1.68
      const height=cfg.celestial?1.25:cfg.forest?1.45:1.54
      const depth=cfg.celestial?1.44:1.24
      const base=-height/2
      if(cfg.celestial)celestialCloud(bob,0,base,0,width,height,depth,index%2===0)
      else if(cfg.forest){
        const mount=new T.Group();mount.position.y=base+.035;bob.add(mount)
        if(!hedge(mount,0,0,width,height,depth,index%2===0))box(bob,0,0,0,width,height,depth,0x39472e)
      }else volcanicRock(bob,0,base,0,width,height,depth,index)
      const swing=pendulum(g,pivot,-middle,d,{width,height,depth},cfg.celestial?'ice':cfg.forest?'leaf':'fire')
      swing.update(0,false)
      hazards.push({type,d,swing})
    }

    // moving obstacles (runner-obstacles.js): main.js drives them through `mover`
    if(type==='sweeper')hazards.push({type,d,x:0,mover:sweeper(g,cfg,-middle,d)})
    if(type==='slider')hazards.push({type,d,x:0,mover:slider(g,cfg,-middle,d)})
    if(type==='boulder')hazards.push({type,d,x,mover:boulder(root,cfg,d,x)})

    const safeX=type==='sweeper'?(Math.random()<.5?-2.8:2.8):type==='boulder'?(x?-Math.sign(x)*2.8:(Math.random()<.5?-2.8:2.8)):type==='rocks'?-Math.sign(x)*2.8:type==='fire'?(Math.random()<.5?-3.2:3.2):type==='gate'?(gateX[side]??0):0
    const safeY=(type==='gap'||type==='hurdle')?3.2:1.25 // near the top of a jump

    // Mario-Kart style Lucky Box pickup (unlocks a weapon for the dungeon)
    if((showcasePickup==='chest' && type==='entry') || (type!=='entry' && type!=='approach' && Math.random()<(cfg.boxes?.chance??.12))){
      const mesh=luckyChest(cfg)??new T.Group()
      if(mesh.children.length===0){
        box(mesh,0,0,0,.95,.8,.68,luckyChestColor(cfg))
        box(mesh,0,0,0,1,.12,.73,0xe0b861)
      }
      mesh.position.set(safeX,safeY,-middle)
      mesh.rotation.y=.45
      g.add(mesh)
      boxes.push({d:piece.d0+middle,x:safeX,y:safeY,mesh})
    }else if(type==='entry'?showcasePickup==='ember':Math.random()<(cfg.embers?.chance??.7)){
      const coin=(o,gx,gy)=>{
        const mesh=emberCoin()
        mesh.position.set(gx,gy,-o);mesh.rotation.y=o*.38;g.add(mesh)
        pickups.push({d:piece.d0+o,x:gx,y:gy,mesh})
      }
      const row=gx=>{for(let k=-2;k<=2;k++)coin(middle+k*1.6,gx,1.2)}
      const hop=at=>{for(let k=-2;k<=2;k++)coin(at+k*1.2,0,1.2+2.5*(1-(k/2.6)**2))} // follows the jump arc
      if(type==='gap')hop(middle+1.5)
      else if(type==='hurdle')hop(middle)
      else row(safeX)
    }
  }
  const gate=new T.Group();root.add(gate);gate.position.copy(endPos);gate.rotation.y=endHeading;arch(gate,0,cfg.celestial)
  const xs=[...pieces.map(p=>p.p0.x),endPos.x],zs=[...pieces.map(p=>p.p0.z),endPos.z]
  const [x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]
  if(cfg.celestial)celestialCloudDeck(root,(x0+x1)/2,(z0+z1)/2,x1-x0+240,z1-z0+240)
  else if(cfg.forest)forestWater(root,(x0+x1)/2,(z0+z1)/2,x1-x0+180,z1-z0+180)
  else if(cfg.infernal)infernalLava(root,(x0+x1)/2,(z0+z1)/2,x1-x0+180,z1-z0+180)
  else box(root,(x0+x1)/2,-5,(z0+z1)/2,x1-x0+120,.5,z1-z0+120,0xce481e)
  let index=0
  const find=d=>{
    while(index>0 && d<pieces[index].d0)index--
    while(index<pieces.length-1 && d>=pieces[index+1].d0)index++
    return pieces[index]
  }
  return {hazards,pickups,boxes,end,endPos,endHeading,
    at:(d,lat,out)=>{const p=find(d);return sample(p,d-p.d0,lat,out)},
    checkpoint:d=>find(d).d0}
}
function arch(g,z,celestial=false){
  for(const x of [-3,3]){
    if(celestial)celestialPillar(g,x,0,z,1.5,5.75)
    else box(g,x,3,z,1.2,6,1.7,0x856a69)
  }
  box(g,0,6,z,7.2,1.2,1.7,celestial?0xc7ad81:0xa68570)
}
export function arena(g,cfg){
  box(g,0,-.5,0,60,1,60,cfg.stone).material=realmFloor(cfg)
  addArenaInlay(g,cfg)
  if(cfg.infernal){
    infernalLava(g,0,0,170,170)
    infernalShrine(g,-33,-25,.49,2.45)
    infernalShrine(g,34,-26,-.39,2.05)
    infernalShrine(g,-35,21,1.17,1.7)
  }else if(cfg.forest)forestWater(g,0,0,170,170)
  else if(cfg.celestial)celestialCloudDeck(g,0,0,210,210)

  const scenery=[[-23,-20],[-26,-4],[-22,19],[22,-22],[25,-8],[23,16]]
  const solids=[]
  scenery.forEach(([x,z],i)=>{
    if(cfg.forest){
      forestTree(g,x,z,31+i*13,{grounded:true,scale:.68+(i%3)*.09})
      solids.push({x,z,r:.55})
    }else if(cfg.celestial){
      const width=1.55+(i%3)*.23
      celestialPillar(g,x,0,z,width,5.6+(i%3)*1.1,i*.83)
      solids.push({x,z,r:width*.49})
    }
  })

  // Leave the central lane and both doors open, with hazards on either flank.
  const hazardGroup=new T.Group(),hazards=[]
  g.add(hazardGroup)
  const positions=[[-12,12],[10,17],[-17,-1],[13,3],[-10,-13],[17,-14],[-17,-22],[8,-23]]
  positions.forEach(([x,z],i)=>{
    const width=3.15+(i%4)*.46,height=1.35+(i%3)*.31,depth=2.4+(i%3)*.47
    if(cfg.celestial)celestialCloud(hazardGroup,x,-.04,z,width,height,depth,i%2===0)
    else if(cfg.forest){
      if(!hedge(hazardGroup,x,z,width,height,depth,i%2===0))box(hazardGroup,x,height/2,z,width,height,depth,0x39472e)
    }else volcanicRock(hazardGroup,x,-.04,z,width,height,depth,i)
    hazards.push({x,z,rx:width*.46,rz:depth*.46})
  })
  // instant-kill obstacles glow in the realm's colour (hazard-glow.js)
  const updateGlow=glowHazards(hazardGroup,cfg.celestial?'heaven':cfg.forest?'forest':'hell',hazards)
  arch(g,-30,cfg.celestial)
  const door=box(g,0,2.5,-30,5,5,.8,cfg.celestial?0xc09a66:0x834e43)
  const entry=box(g,0,2,30,6,4,.65,cfg.celestial?0xb5b0a1:0x675465)
  const stall=new T.Group(); stall.position.set(0,0,-14); g.add(stall); stall.visible=false
  box(stall,0,.55,0,3.2,1.1,1.6,0x59362b)
  box(stall,0,1.15,0,3.5,.16,1.8,0xd99b52)
  for(const s of [-1.45,1.45])box(stall,s,2.1,-.65,.18,2.1,.18,0x7d4c3c)
  box(stall,0,3.15,-.3,3.6,.22,2.1,0x9e342b)
  const orb=new T.Mesh(gemGeo,gemMat); orb.position.set(0,1.75,0); stall.add(orb)
  stall.userData.orb=orb
  return {door,entry,stall,hazardGroup,hazards,solids,updateGlow}
}
export function heaven(g){
  celestialCloudDeck(g,0,-47,240,250)
  box(g,0,.014,-49.5,3.3,.028,99,0x982238).material=redCarpet
  for(const s of [-1,1])box(g,s*1.55,.03,-49.5,.045,.009,99,0xd7a754)
  for(let i=0;i<26;i++){
    box(g,0,-.5,-i*4,6,1,4,0xfff4d6).material=marbleFloor
    for(const s of [-1,1]){
      if(i%3===0)celestialPillar(g,s*4.5,-2.6,-i*4,1.9,7.4,i*.6)
      if(i%2===0)celestialCloud(g,s*(8+i%5),-7,-i*4,12,4.5,9,i%3===0,true)
    }
  }
  arch(g,-99,true)
}
