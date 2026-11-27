import * as T from 'three'
import {volcanicRock} from './rocks.js'
import {hedge} from './hedges.js'
import {celestialCloud} from './celestial.js'

// Three moving runner obstacles. Each builder adds its meshes to the segment group `g` (built in world.js, local
// frame: -z is forward, +x is right) and returns a mover with:
//   update(dt,clock,dist,route,active)  animate (active is false while the runner holds still after a respawn)
//   hits(dist,lat,height)                true when the runner touches it (route space, like the other hazards)
//   near(dist,lat,height)                a wider version of hits, used for close calls
//   reset(dist)                          put it back after a respawn
// main.js calls these from run(); the hazard keeps `type`, `d` (centre distance) and `x` like the others.

const realm=cfg=>cfg.celestial?'heaven':cfg.forest?'forest':'hell'
const LOOK={
  hell:{metal:0x2b2025,glow:0xff5a1f,trim:0xffb54f,stone:0x3a2a30},
  forest:{metal:0x5a4230,glow:0x7ee06a,trim:0xd7b036,stone:0x55543b},
  heaven:{metal:0xe8dcc0,glow:0xffd36e,trim:0xc7ad81,stone:0xf1ede4}
}
const geo={
  box:new T.BoxGeometry(),plane:new T.PlaneGeometry(),cyl:new T.CylinderGeometry(1,1,1,20),cone:new T.ConeGeometry(1,1,6),
  ring:new T.RingGeometry(.97,1,72),disc:new T.CircleGeometry(1,72),rock:new T.IcosahedronGeometry(1,2)
}
{ // lumpy boulder
  const p=geo.rock.attributes.position,v=new T.Vector3()
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.09*Math.sin(v.x*5.1+v.y*3.7)*Math.cos(v.z*4.3-v.y*2.2);v.multiplyScalar(n);p.setXYZ(i,v.x,v.y,v.z)}
  geo.rock.computeVertexNormals()
}
const mats=new Map()
function mat(color,emissive=0,intensity=0,extra={}){
  const key=[color,emissive,intensity,JSON.stringify(extra)].join()
  if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:.7,flatShading:true,...extra}))
  return mats.get(key)
}
const glowMat=new Map()
function glow(color,opacity=.55){
  const key=color+':'+opacity
  if(!glowMat.has(key))glowMat.set(key,new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}))
  return glowMat.get(key)
}
function mesh(parent,geometry,material,x,y,z,sx,sy,sz){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m
}
function floorMark(parent,geometry,color,x,z,sx,sz,opacity){
  const m=mesh(parent,geometry,glow(color,opacity),x,.035,z,sx,sz,1);m.rotation.x=-Math.PI/2;return m
}

// ── Sweeper: a low spiked arm spinning around a post in the middle of the track. Jump it as it comes round.
const SWEEP_R=4.4,SWEEP_Y=.55,SWEEP_SPEED=2.1
export function sweeper(g,cfg,z,d){
  const look=LOOK[realm(cfg)]
  mesh(g,geo.cyl,mat(look.metal),0,.85,z,.32,1.7,.32)
  mesh(g,geo.cyl,mat(look.trim,look.glow,.6),0,1.75,z,.42,.16,.42)
  floorMark(g,geo.ring,look.glow,0,z,SWEEP_R,SWEEP_R,.7)
  floorMark(g,geo.disc,look.glow,0,z,SWEEP_R,SWEEP_R,.08)
  const arm=new T.Group();arm.position.set(0,SWEEP_Y,z);g.add(arm)
  mesh(arm,geo.box,mat(look.metal,look.glow,.25),0,0,0,SWEEP_R*2,.3,.3)
  mesh(arm,geo.box,mat(look.glow,look.glow,1.6),0,0,0,SWEEP_R*2-.1,.12,.34)
  for(let k=-4;k<=4;k++){
    if(!k)continue
    for(const s of [-1,1]){const c=mesh(arm,geo.cone,mat(look.trim,look.glow,.4),k*.95,0,s*.27,.09,.32,.09);c.rotation.x=s*Math.PI/2}
  }
  const seed=d*.37
  let angle=0
  const local=(dist,lat)=>({px:lat,pz:-(dist-d)}) // runner position in the arm's plane
  const test=(dist,lat,height,pad,top)=>{
    const {px,pz}=local(dist,lat),r=Math.hypot(px,pz)
    if(r<.42+pad)return true // the post
    if(height>top || r>SWEEP_R+.3)return false
    // distance from the runner to the arm's line through the post
    return Math.abs(px*Math.sin(angle)+pz*Math.cos(angle))<.42+pad
  }
  return {
    update(dt,clock){angle=clock*SWEEP_SPEED+seed;arm.rotation.y=angle},
    hits:(dist,lat,height)=>test(dist,lat,height,0,.82),
    near:(dist,lat,height)=>test(dist,lat,height,.9,1.5),
    reset(){}
  }
}

// ── Slider: a tall wall sliding from side to side across the track. Step round it, or jump it at the top of a jump.
const SLIDE_W=2.7,SLIDE_H=2.7,SLIDE_D=1.3,SLIDE_RANGE=2.9
export function slider(g,cfg,z,d){
  const kind=realm(cfg),look=LOOK[kind]
  floorMark(g,geo.plane,look.glow,0,z,8.6,SLIDE_D+.5,.18)
  for(const s of [-1,1])floorMark(g,geo.plane,look.glow,0,z+s*(SLIDE_D/2+.3),8.6,.07,.9)
  const wall=new T.Group();wall.position.set(0,0,z);g.add(wall)
  if(kind==='forest'){
    if(!hedge(wall,0,0,SLIDE_W,SLIDE_H,SLIDE_D,d%2<1))mesh(wall,geo.box,mat(0x39472e),0,SLIDE_H/2,0,SLIDE_W,SLIDE_H,SLIDE_D)
  }else if(kind==='heaven'){
    mesh(wall,geo.box,mat(look.stone,0,0,{flatShading:false,roughness:.45}),0,SLIDE_H/2,0,SLIDE_W,SLIDE_H,SLIDE_D)
    celestialCloud(wall,0,SLIDE_H-.25,0,SLIDE_W*1.15,.9,SLIDE_D*1.2)
  }else volcanicRock(wall,0,-.04,0,SLIDE_W,SLIDE_H,SLIDE_D,Math.round(d),true)
  // glowing trim so the moving edge reads at speed
  for(const s of [-1,1])mesh(wall,geo.box,mat(look.glow,look.glow,1.4),s*(SLIDE_W/2+.03),SLIDE_H*.45,0,.08,SLIDE_H*.85,SLIDE_D*.7)
  const speed=1.25+((d*7)%5)*.08,seed=d*.61
  let x=0
  const test=(dist,lat,height,pad)=>Math.abs(dist-d)<SLIDE_D/2+.35+pad*.5 && Math.abs(lat-x)<SLIDE_W/2+.35+pad && height<SLIDE_H+pad*.6
  return {
    update(dt,clock){x=SLIDE_RANGE*Math.sin(clock*speed+seed);wall.position.x=x},
    hits:(dist,lat,height)=>test(dist,lat,height,0),
    near:(dist,lat,height)=>test(dist,lat,height,.75),
    reset(){}
  }
}

// ── Boulder: once the runner is close it rolls down its lane towards them. Change lanes, or jump it.
const BOULDER_R=1.05,ROLL_SPEED=11,TRIGGER=55,START_AHEAD=42
export function boulder(root,cfg,d,x){
  const kind=realm(cfg),look=LOOK[kind]
  const outer=new T.Group(),spin=new T.Group();outer.add(spin);root.add(outer)
  const material=kind==='hell'?mat(0x3a2a30,0xff3a08,.12):kind==='forest'?mat(0x6b6a4c,0x2a5a18,.25):mat(0xf6f1e6,0xffd36e,.25)
  mesh(spin,geo.rock,material,0,0,0,BOULDER_R,BOULDER_R,BOULDER_R)
  for(let k=0;k<3;k++){ // glowing bands so the spin is visible
    const band=mesh(spin,geo.cyl,mat(look.glow,look.glow,1.6),0,0,0,BOULDER_R*1.01,.09,BOULDER_R*1.01)
    band.rotation.set(k*1.05,k*.7,Math.PI/2+k*.4)
  }
  const shadow=floorMark(root,geo.disc,0x000000,0,0,BOULDER_R*1.1,BOULDER_R*1.1,0)
  shadow.material=new T.MeshBasicMaterial({color:0,transparent:true,opacity:.35,depthWrite:false})
  let at=d,started=false,rolled=0
  const pos=new T.Vector3()
  function place(route){
    const h=route.at(at,x,pos)
    outer.position.set(pos.x,BOULDER_R-.04,pos.z);outer.rotation.y=h
    shadow.position.set(pos.x,.04,pos.z)
    spin.rotation.x=rolled/BOULDER_R
  }
  const test=(dist,lat,height,pad)=>started && Math.abs(dist-at)<BOULDER_R+.35+pad && Math.abs(lat-x)<BOULDER_R+.4+pad && height<1.45+pad
  return {
    behind:dist=>started && dist>at+BOULDER_R+.6, // the runner is past it
    update(dt,clock,dist,route,active){
      if(!started && dist>d-TRIGGER){started=true;at=Math.max(d,dist+START_AHEAD)}
      if(started && active){at-=dt*ROLL_SPEED;rolled+=dt*ROLL_SPEED}
      outer.visible=shadow.visible=dist-at<40
      if(outer.visible)place(route)
    },
    hits:(dist,lat,height)=>test(dist,lat,height,0),
    near:(dist,lat,height)=>test(dist,lat,height,.8),
    reset(dist,route){started=false;at=d;rolled=0;outer.visible=shadow.visible=true;place(route)}
  }
}
