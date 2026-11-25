import * as T from 'three'
import {volcanicRock} from './rocks.js'
import {fingerPillar} from './pillars.js'
const cube = new T.BoxGeometry()
const materials = new Map()
export function box(parent,x,y,z,w,h,d,color) {
  if (!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,flatShading:true}))
  const mesh = new T.Mesh(cube,materials.get(color))
  mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh)
  return mesh
}
export function sword(parent,x,y,z) {
  const g=new T.Group(); parent.add(g); g.position.set(x,y,z)
  box(g,0,.6,0,.17,1.2,.13,0xffde94); box(g,0,0,0,.65,.12,.15,0xffa23c)
  box(g,0,-.21,0,.12,.35,.12,0x713c30); return g
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
  g.userData.weapon=sword(g,.57,.85,-.23); if(boss) g.scale.setScalar(1.85)
  return g
}
const sideX={left:-1.8,center:0,right:1.8}, gateX={left:-2.5,center:0,right:2.5}
const gemGeo=new T.OctahedronGeometry(.34), gemMat=new T.MeshStandardMaterial({color:0xffd75e,emissive:0xff8a1c,emissiveIntensity:.7,flatShading:true})
const TURN_RADIUS=6, tmpA=new T.Vector3(), tmpB=new T.Vector3()
export const forward=(h,v=new T.Vector3())=>v.set(-Math.sin(h),0,-Math.cos(h))
const rightOf=(h,v=new T.Vector3())=>v.set(Math.cos(h),0,-Math.sin(h))
// World position of a point s units into a piece, lat units right of its centre line. Returns the heading.
function sample(p,s,lat,out){
  if(p.kind==='straight'){
    out.copy(p.p0).addScaledVector(forward(p.h0,tmpA),s).addScaledVector(rightOf(p.h0,tmpB),lat)
    return p.h0
  }
  const sg=Math.sign(p.turn),h=p.h0+sg*s/TURN_RADIUS
  out.copy(p.p0).addScaledVector(rightOf(p.h0,tmpA),-sg*TURN_RADIUS).addScaledVector(rightOf(h,tmpB),sg*TURN_RADIUS+lat)
  return h
}
// Lays the route out as pieces: a straight piece per segment, plus a curved piece wherever cfg.turns puts a turn.
function layout(cfg,route){
  const turns=new Map();let after=0
  for(const t of cfg.turns??[]){after+=t.after;turns.set(after,(turns.get(after)??0)-t.angle*Math.PI/180)}
  const pieces=[],pos=new T.Vector3();let h=0,d=0
  const add=piece=>{pieces.push(piece);d+=piece.length;h=sample(piece,piece.length,0,pos)}
  route.forEach((seg,i)=>{
    add({kind:'straight',seg,d0:d,length:cfg.segmentLength,p0:pos.clone(),h0:h})
    const turn=turns.get(i) // route index i is obstacle segment i (the entry is 0)
    if(turn && i<route.length-1)add({kind:'arc',d0:d,length:TURN_RADIUS*Math.abs(turn),p0:pos.clone(),h0:h,turn})
  })
  return {pieces,end:d,endPos:pos.clone(),endHeading:h}
}
function curve(root,p,cfg){
  const n=Math.max(2,Math.ceil(Math.abs(p.turn)/(Math.PI/36))),step=p.length/n,sg=Math.sign(p.turn),v=new T.Vector3()
  const arcDepth=lat=>(TURN_RADIUS+sg*lat)*Math.abs(p.turn)/n*1.15+.1
  for(let k=0;k<n;k++){
    const h=sample(p,(k+.5)*step,0,v)
    box(root,v.x,-.6,v.z,9,1.2,arcDepth(-sg*4.5),cfg.stone).rotation.y=h
    for(const s of [-1,1]){sample(p,(k+.5)*step,s*4.3,v);box(root,v.x,.07,v.z,.25,.14,arcDepth(s*4.3),0xc47b54).rotation.y=h}
  }
}
export function runner(root,cfg,route){
  const hazards=[], pickups=[], length=cfg.segmentLength, middle=length/2
  const {pieces,end,endPos,endHeading}=layout(cfg,route)
  for(const piece of pieces){
    if(piece.kind==='arc'){curve(root,piece,cfg);continue}
    const {type,side}=piece.seg, d=piece.d0+middle, x=sideX[side]??0
    const g=new T.Group(); root.add(g); g.position.copy(piece.p0); g.rotation.y=piece.h0
    const floor=(a,b)=>box(g,0,-.6,-(a+b)/2,9,1.2,b-a,cfg.stone)
    if(type==='gap'){
      floor(0,middle);floor(middle+3,length)
      box(g,0,.02,-middle+.18,9,.04,.36,0xffb54f)
      hazards.push({type,d})
    }else floor(0,length)
    for(let k=0;k<4;k++){
      const side=k%2?1:-1
      const z=-k*length/4
      if(!fingerPillar(g,side,z,piece.d0*4+k))box(g,side*6,1,z,1.5,5+k,1.6,0x472c37).rotation.z=side*.16
      box(g,side*4.3,.07,-k*length/4,.25,.14,4,0xc47b54)
    }
    if(type==='rocks'){
      const side=Math.sign(x), variant=Math.round(piece.d0)
      volcanicRock(g,x+side*.62,-.06,-middle,2.65,1.92,2.1,variant)
      volcanicRock(g,x-side*.83,-.04,-middle+.18,2.18,1.45,1.92,variant+3)
      volcanicRock(g,x+side*1.45,-.04,-middle-.45,1.1,.72,1.18,variant+5)
      hazards.push({type,d,x})
    }
    if(type==='fire'){
      box(g,x,.05,-middle,4,.1,2,0xc08146)
      hazards.push({type,d,x,mesh:box(g,x,1,-middle,4,2,2,0xff631d)})
    }
    if(type==='hurdle'){ // full-width spiked wall: jump it
      box(g,0,.55,-middle,9,1.1,.6,0x8c3b2e)
      for(let k=-4;k<=4;k++)box(g,k,1.25,-middle,.25,.3,.25,0xffb54f)
      hazards.push({type,d})
    }
    if(type==='gate'){ // wall with one opening: steer through it
      const ox=gateX[side]??0
      for(const [a,b] of [[-4.5,ox-1.5],[ox+1.5,4.5]]){
        const width=b-a
        if(width<=.05)continue
        const variant=Math.floor(piece.d0/length)+(a>ox?1:0)
        volcanicRock(g,(a+b)/2,-.04,-middle,width,2.44,1.38,variant,true)
      }
      hazards.push({type,d,x:ox})
    }
    if(type==='pendulum'){ // blade swinging across the track: time it
      for(const s of [-1,1])box(g,s*5,3.3,-middle,.6,6.6,.6,0x5a4048)
      box(g,0,6.6,-middle,10.6,.5,.6,0x5a4048)
      const pivot=new T.Group();g.add(pivot);pivot.position.set(0,6.3,-middle)
      box(pivot,0,-2.8,0,.15,5.6,.15,0x2c2630)
      box(pivot,0,-5.6,0,1.2,1.2,.5,0xd8d0c0).rotation.z=Math.PI/4
      hazards.push({type,d,mesh:pivot,pivotY:6.3,arm:5.6})
    }
    // Embers: a row of gems on the safe line through this segment's obstacle
    const gem=(o,gx,gy)=>{const mesh=new T.Mesh(gemGeo,gemMat);mesh.position.set(gx,gy,-o);g.add(mesh);pickups.push({d:piece.d0+o,x:gx,y:gy,mesh})}
    const row=gx=>{for(let k=-2;k<=2;k++)gem(middle+k*1.6,gx,1.2)}
    const hop=at=>{for(let k=-2;k<=2;k++)gem(at+k*1.2,0,1.2+1.4*(1-(k/2.6)**2))}
    if(type!=='entry' && Math.random()<(cfg.embers?.chance??.7)){
      if(type==='rocks')row(-Math.sign(x)*2.8)
      else if(type==='fire')row(Math.random()<.5?-3.2:3.2)
      else if(type==='gap')hop(middle+1.5)
      else if(type==='hurdle')hop(middle)
      else if(type==='gate')row(gateX[side]??0)
      else row(0) // pendulum (risky) and approach
    }
  }
  const gate=new T.Group();root.add(gate);gate.position.copy(endPos);gate.rotation.y=endHeading;arch(gate,0)
  const xs=[...pieces.map(p=>p.p0.x),endPos.x],zs=[...pieces.map(p=>p.p0.z),endPos.z]
  const [x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]
  box(root,(x0+x1)/2,-5,(z0+z1)/2,x1-x0+120,.5,z1-z0+120,0xce481e)
  let index=0
  const find=d=>{
    while(index>0 && d<pieces[index].d0)index--
    while(index<pieces.length-1 && d>=pieces[index+1].d0)index++
    return pieces[index]
  }
  return {hazards,pickups,end,endPos,endHeading,
    at:(d,lat,out)=>{const p=find(d);return sample(p,d-p.d0,lat,out)}, // writes world position, returns heading
    checkpoint:d=>find(d).d0}
}
function arch(g,z){
  for(const x of [-3,3])box(g,x,3,z,1.2,6,1.7,0x856a69)
  box(g,0,6,z,7.2,1.2,1.7,0xa68570)
}
export function arena(g,cfg){
  box(g,0,-.5,0,19,1,19,cfg.stone)
  for(const s of [-1,1])for(const t of [-1,1])box(g,s*9,2,t*8,1,4,1,0x937668)
  arch(g,-9); const door=box(g,0,2.5,-9,5,5,.8,0x834e43)
  const entry=box(g,0,2,9,6,4,.65,0x675465)
  return {door,entry}
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
