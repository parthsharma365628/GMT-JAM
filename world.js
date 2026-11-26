import * as T from 'three'
import {volcanicRock} from './rocks.js'
import {fingerPillar} from './pillars.js'
import {hedge} from './hedges.js'
import {forestPathMaterial,forestTree,forestWater} from './forest.js'
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
const luckyGeo=new T.BoxGeometry(.85,.85,.85)
const luckyMat=new T.MeshStandardMaterial({color:0x4deeea,emissive:0x1b7ced,emissiveIntensity:.65,flatShading:true})
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
function curve(root,p,cfg){
  const n=Math.max(2,Math.ceil(Math.abs(p.turn)/(Math.PI/36))),step=p.length/n,sg=Math.sign(p.turn),v=new T.Vector3()
  const arcDepth=lat=>(TURN_RADIUS+sg*lat)*Math.abs(p.turn)/n*1.15+.1
  for(let k=0;k<n;k++){
    const h=sample(p,(k+.5)*step,0,v)
    const ground=box(root,v.x,-.6,v.z,9,1.2,arcDepth(-sg*4.5),cfg.stone)
    ground.rotation.y=h
    if(cfg.forest)ground.material=forestPathMaterial
    for(const s of [-1,1]){sample(p,(k+.5)*step,s*4.3,v);box(root,v.x,.07,v.z,.25,.14,arcDepth(s*4.3),cfg.forest?0x816148:0xc47b54).rotation.y=h}
  }
}
export function runner(root,cfg,route){
  const hazards=[], pickups=[], boxes=[], length=cfg.segmentLength, middle=length/2
  const {pieces,end,endPos,endHeading}=layout(cfg,route)
  for(const piece of pieces){
    if(piece.kind==='arc'){curve(root,piece,cfg);continue}
    const {type,side}=piece.seg, d=piece.d0+middle, x=sideX[side]??0
    const g=new T.Group(); root.add(g); g.position.copy(piece.p0); g.rotation.y=piece.h0
    const floor=(a,b)=>{
      const ground=box(g,0,-.6,-(a+b)/2,9,1.2,b-a,cfg.stone)
      if(cfg.forest)ground.material=forestPathMaterial
    }
    if(type==='gap'){
      floor(0,middle);floor(middle+3,length)
      box(g,0,.02,-middle+.18,9,.04,.36,0xffb54f)
      hazards.push({type,d})
    }else floor(0,length)
    for(let k=0;k<4;k++){
      const side=k%2?1:-1
      const z=-k*length/4
      if(cfg.forest){
        const seed=piece.d0*4+k
        forestTree(g,side*(7.4+k*.19),z,seed)
        forestTree(g,side*(12+(k%3)*1.34),z-2.6,seed+5,true)
      }else if(!fingerPillar(g,side,z,piece.d0*4+k)){
        box(g,side*6,1,z,1.5,5+k,1.6,0x472c37).rotation.z=side*.16
      }
      box(g,side*4.3,.07,z,.25,.14,4,cfg.forest?0x816148:0xc47b54)
    }
    if(type==='rocks'){
      const side=Math.sign(x), variant=Math.round(piece.d0)
      if(cfg.hedgeObstacles){
        if(!hedge(g,x,-middle,4,1.8,2.12,side<0))box(g,x,.9,-middle,4,1.8,2.12,0x39472e)
      }else{
        volcanicRock(g,x+side*.62,-.06,-middle,2.65,1.92,2.1,variant)
        volcanicRock(g,x-side*.83,-.04,-middle+.18,2.18,1.45,1.92,variant+3)
        volcanicRock(g,x+side*1.45,-.04,-middle-.45,1.1,.72,1.18,variant+5)
      }
      hazards.push({type,d,x})
    }
    if(type==='fire'){
      box(g,x,.05,-middle,4,.1,2,0xc08146)
      hazards.push({type,d,x,mesh:box(g,x,1,-middle,4,2,2,0xff631d)})
    }
    if(type==='hurdle'){
      box(g,0,.55,-middle,9,1.1,.6,cfg.forest?0x66513b:0x8c3b2e)
      for(let k=-4;k<=4;k++)box(g,k,1.25,-middle,.25,.3,.25,0xffb54f)
      hazards.push({type,d})
    }
    if(type==='gate'){
      const ox=gateX[side]??0
      for(const [a,b] of [[-4.5,ox-1.5],[ox+1.5,4.5]]){
        const width=b-a
        if(width<=.05)continue
        const center=(a+b)/2
        if(cfg.hedgeObstacles){
          if(!hedge(g,center,-middle,width,2.44,1.38,a>ox))box(g,center,1.2,-middle,width,2.4,1.38,0x39472e)
        }else{
          const variant=Math.floor(piece.d0/length)+(a>ox?1:0)
          volcanicRock(g,center,-.04,-middle,width,2.44,1.38,variant,true)
        }
      }
      hazards.push({type,d,x:ox})
    }
    if(type==='pendulum'){
      for(const s of [-1,1])box(g,s*5,3.3,-middle,.6,6.6,.6,0x5a4048)
      box(g,0,6.6,-middle,10.6,.5,.6,0x5a4048)
      const pivot=new T.Group();g.add(pivot);pivot.position.set(0,6.3,-middle)
      box(pivot,0,-2.8,0,.15,5.6,.15,0x2c2630)
      box(pivot,0,-5.6,0,1.2,1.2,.5,0xd8d0c0).rotation.z=Math.PI/4
      hazards.push({type,d,mesh:pivot,pivotY:6.3,arm:5.6})
    }

    const safeX=type==='rocks'?-Math.sign(x)*2.8:type==='fire'?(Math.random()<.5?-3.2:3.2):type==='gate'?(gateX[side]??0):0
    const safeY=(type==='gap'||type==='hurdle')?2.3:1.25

    // Mario-Kart style Lucky Box pickup (unlocks a weapon for the dungeon)
    if(type!=='entry' && type!=='approach' && Math.random()<(cfg.boxes?.chance??.12)){
      const mesh=new T.Mesh(luckyGeo,luckyMat)
      mesh.position.set(safeX,safeY,-middle)
      mesh.rotation.set(.4,.6,.3)
      box(mesh,0,0,0,.96,.18,.96,0xffd75e)
      g.add(mesh)
      boxes.push({d:piece.d0+middle,x:safeX,y:safeY,mesh})
    }else if(type!=='entry' && Math.random()<(cfg.embers?.chance??.7)){
      const gem=(o,gx,gy)=>{const mesh=new T.Mesh(gemGeo,gemMat);mesh.position.set(gx,gy,-o);g.add(mesh);pickups.push({d:piece.d0+o,x:gx,y:gy,mesh})}
      const row=gx=>{for(let k=-2;k<=2;k++)gem(middle+k*1.6,gx,1.2)}
      const hop=at=>{for(let k=-2;k<=2;k++)gem(at+k*1.2,0,1.2+1.4*(1-(k/2.6)**2))}
      if(type==='gap')hop(middle+1.5)
      else if(type==='hurdle')hop(middle)
      else row(safeX)
    }
  }
  const gate=new T.Group();root.add(gate);gate.position.copy(endPos);gate.rotation.y=endHeading;arch(gate,0)
  const xs=[...pieces.map(p=>p.p0.x),endPos.x],zs=[...pieces.map(p=>p.p0.z),endPos.z]
  const [x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]
  if(cfg.forest)forestWater(root,(x0+x1)/2,(z0+z1)/2,x1-x0+180,z1-z0+180)
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
function arch(g,z){
  for(const x of [-3,3])box(g,x,3,z,1.2,6,1.7,0x856a69)
  box(g,0,6,z,7.2,1.2,1.7,0xa68570)
}
export function arena(g,cfg){
  box(g,0,-.5,0,60,1,60,cfg.stone)
  for(const s of [-1,1])for(const t of [-1,1])box(g,s*17,2,t*17,1,4,1,0x937668)
  arch(g,-30); const door=box(g,0,2.5,-30,5,5,.8,0x834e43)
  const entry=box(g,0,2,30,6,4,.65,0x675465)
  const stall=new T.Group(); stall.position.set(0,0,-14); g.add(stall); stall.visible=false
  box(stall,0,.55,0,3.2,1.1,1.6,0x59362b)
  box(stall,0,1.15,0,3.5,.16,1.8,0xd99b52)
  for(const s of [-1.45,1.45])box(stall,s,2.1,-.65,.18,2.1,.18,0x7d4c3c)
  box(stall,0,3.15,-.3,3.6,.22,2.1,0x9e342b)
  const orb=new T.Mesh(gemGeo,gemMat); orb.position.set(0,1.75,0); stall.add(orb)
  stall.userData.orb=orb
  return {door,entry,stall}
}
export function heaven(g){
  for(let i=0;i<26;i++){
    box(g,0,-.5,-i*4,6,1,4,0xfff4d6)
    for(const s of [-1,1]){
      if(i%3===0)box(g,s*3,1,-i*4,.5,3,.5,0xe5b95e)
      box(g,s*(9+i%5),-2+i%3,-i*4,7,2,5,0xfffaf2)
    }
  }
  arch(g,-99)
}
