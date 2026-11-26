import * as T from 'three'

// Lava jet: replaces the runner's timed fire block. It follows the same 3.5 s cycle main.js uses for collisions:
//   off  (cycle < WARN_AT)     a molten pool that gurgles gently
//   warn (WARN_AT..ERUPT_AT)   heavy bubbling, the pool glows brighter
//   on   (cycle >= ERUPT_AT)   a churning column of lava bursts out (same size as the old block) and sprays blobs
// Build one with lavaJet(parent,x,z) and call jet.update(dt,cycle) every frame.
export const WARN_AT=1.5, ERUPT_AT=2.2, CYCLE=3.5

const blobGeo=new T.IcosahedronGeometry(1,0)
const domeGeo=new T.SphereGeometry(1,7,4,0,Math.PI*2,0,Math.PI/2)
const ringGeo=new T.RingGeometry(.7,1,14).rotateX(-Math.PI/2)
const planeGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)
const cube=new T.BoxGeometry()
const HOT=new T.Color(0xffd25a),WARM=new T.Color(0xff6a1c),COOL=new T.Color(0x5a1208)
const rimMat=new T.MeshStandardMaterial({color:0x2a1418,roughness:.9,flatShading:true})
const GRAVITY=22,POOL_Y=.17
const rand=(a,b)=>a+Math.random()*(b-a)
const basic=color=>new T.MeshBasicMaterial({color})

export function lavaJet(parent,x,z,{w=4,d=2,h=2.6}={}){
  const g=new T.Group();g.position.set(x,0,z);parent.add(g)
  const rim=new T.Mesh(cube,rimMat);rim.scale.set(w+.7,.2,d+.7);rim.position.y=.04;g.add(rim) // rim top at .14, just under the pool
  const pool=new T.Mesh(planeGeo,basic(WARM.clone()));pool.scale.set(w,1,d);pool.position.y=POOL_Y;g.add(pool)
  const core=new T.Mesh(planeGeo,basic(HOT.clone()));core.position.y=POOL_Y+.03;g.add(core)
  // the column: a loose grid of blobs that fill the w × d × h volume while erupting
  const column=new T.Group();g.add(column)
  const cells=[]
  for(let ix=0;ix<4;ix++)for(let iz=0;iz<2;iz++)for(let iy=0;iy<3;iy++){
    const m=new T.Mesh(blobGeo,basic(WARM.clone()))
    const base=new T.Vector3((ix+.5)/4*w-w/2,(iy+.5)/3*h,(iz+.5)/2*d-d/2)
    m.position.copy(base);column.add(m)
    cells.push({m,base,size:rand(.62,.8)*Math.min(w/4,d/2,h/3)*1.15,phase:rand(0,6.3),speed:rand(7,12)})
  }
  column.visible=false
  const bubbles=[],blobs=[],rings=[]
  let nextBubble=0,spray=0,time=0,rise=0,wasOn=false

  function bubble(big){
    const r=rand(.18,.42)*(big?1.5:1)
    const m=new T.Mesh(domeGeo,basic(WARM.clone().lerp(HOT,Math.random()*.6)))
    m.position.set(rand(-w/2+.3,w/2-.3),POOL_Y,rand(-d/2+.25,d/2-.25));m.scale.setScalar(.01);g.add(m)
    bubbles.push({m,r,life:rand(.5,1.1)*(big?.7:1),age:0})
  }
  function blob(px,py,pz,speed,spread,size){
    const m=new T.Mesh(blobGeo,basic(HOT.clone()));m.position.set(px,py,pz);m.scale.setScalar(size);g.add(m)
    const a=Math.random()*Math.PI*2,s=rand(0,spread)
    blobs.push({m,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:speed,size,spin:rand(-8,8),age:0})
  }
  function ring(px,pz,size){
    const m=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:WARM,transparent:true,depthWrite:false}))
    m.position.set(px,POOL_Y+.02,pz);m.scale.setScalar(size);g.add(m);rings.push({m,size,age:0})
  }
  const drop=(list,i,o)=>{o.m.removeFromParent();o.m.material.dispose();list.splice(i,1)}

  function update(dt,cycle){
    time+=dt
    const on=cycle>=ERUPT_AT,warn=!on && cycle>=WARN_AT
    const charge=warn?(cycle-WARN_AT)/(ERUPT_AT-WARN_AT):on?1:0
    // pool glow
    const glow=on?.8+.2*Math.sin(time*30):charge*(.75+.25*Math.sin(time*40))
    pool.material.color.copy(WARM).lerp(HOT,glow*.55)
    core.scale.set(w*(.25+.55*glow),1,d*(.25+.55*glow))
    // gurgling bubbles
    if((nextBubble-=dt)<=0){bubble(warn);nextBubble=warn?rand(.03,.09):on?rand(.15,.3):rand(.18,.45)}
    for(let i=bubbles.length-1;i>=0;i--){
      const b=bubbles[i];b.age+=dt;const k=b.age/b.life
      if(k<1){const s=b.r*Math.sin(Math.min(1,k*1.15)*Math.PI/2);b.m.scale.set(s*(1+.12*Math.sin(b.age*18)),s*.8*(1+.2*Math.sin(b.age*13)),s)}
      else{
        for(let j=0;j<2+(warn?2:0);j++)blob(b.m.position.x,POOL_Y,b.m.position.z,rand(2.5,warn?6:4.5),rand(.5,1.5),b.r*.3)
        ring(b.m.position.x,b.m.position.z,b.r*1.3);drop(bubbles,i,b)
      }
    }
    // eruption: the column shoots up fast, churns, and sprays blobs; it sinks back with a splash when the cycle ends
    if(on && !wasOn){
      for(let i=0;i<14;i++)blob(rand(-w/2,w/2),POOL_Y,rand(-d/2,d/2),rand(9,14),rand(.8,3),rand(.22,.4))
      ring(0,0,Math.max(w,d)*.7)
    }
    if(!on && wasOn){
      for(let i=0;i<8;i++)blob(rand(-w/2,w/2),h*.5,rand(-d/2,d/2),rand(1,4),rand(1,2.5),rand(.2,.34))
      ring(0,0,Math.max(w,d)*.8)
    }
    wasOn=on
    rise=on?Math.min(1,rise+dt/.12):0
    column.visible=on
    if(on){
      const sink=Math.min(1,(CYCLE-cycle)/.18) // shrink in the last moment before the cycle wraps
      column.scale.set(1,rise*sink,1)
      for(const c of cells){
        const pulse=1+.22*Math.sin(time*c.speed+c.phase)
        c.m.position.set(c.base.x+.12*Math.sin(time*9+c.phase),c.base.y+.15*Math.sin(time*11+c.phase*2),c.base.z)
        c.m.scale.set(c.size*pulse,c.size*pulse*1.15,c.size*pulse)
        c.m.rotation.y=time*2+c.phase
        c.m.material.color.copy(WARM).lerp(HOT,.5+.5*Math.sin(time*14+c.phase))
      }
      if((spray-=dt)<=0){blob(rand(-w/2+.4,w/2-.4),h*rise,rand(-d/2+.3,d/2-.3),rand(3,7),rand(.6,2.2),rand(.14,.28));spray=.035}
    }
    // flying blobs: arc under gravity, stretch along their motion, cool as they fall, splash back into the pool
    for(let i=blobs.length-1;i>=0;i--){
      const b=blobs[i];b.age+=dt
      b.vy-=GRAVITY*dt;b.m.position.x+=b.vx*dt;b.m.position.y+=b.vy*dt;b.m.position.z+=b.vz*dt
      const st=1+Math.min(1.2,Math.abs(b.vy)*.06)
      b.m.scale.set(b.size/Math.sqrt(st),b.size*st,b.size/Math.sqrt(st));b.m.rotation.y+=b.spin*dt
      b.m.material.color.copy(HOT).lerp(WARM,Math.min(1,b.age*1.6)).lerp(COOL,Math.max(0,Math.min(1,(b.age-.6))))
      if(b.m.position.y<POOL_Y && b.vy<0){if(b.size>.18)ring(b.m.position.x,b.m.position.z,b.size*2.2);drop(blobs,i,b)}
    }
    for(let i=rings.length-1;i>=0;i--){
      const r=rings[i];r.age+=dt;r.m.scale.setScalar(r.size*(1+r.age*2.2));r.m.material.opacity=Math.max(0,1-r.age/.5)
      if(r.age>.5)drop(rings,i,r)
    }
  }
  return {group:g,update}
}

// Golden gate: Heaven's version of the timed block, on the same cycle.
//   off   a faint, see-through gate that flickers
//   warn  flickers faster and fades in
//   on    a solid golden gate (only slightly see-through): deadly
const GHOST=new T.Color(0xfff4d6),SOLID=new T.Color(0xf0a832)
export function goldenGate(parent,x,z,{w=4,d=2,h=2.6}={}){
  const g=new T.Group();g.position.set(x,0,z);parent.add(g)
  const gold=new T.MeshStandardMaterial({color:0xffcf6a,emissive:0xb07a1c,emissiveIntensity:.5,metalness:.35,roughness:.35,
    flatShading:true,transparent:true,opacity:.25,depthWrite:false})
  const trim=new T.MeshStandardMaterial({color:0xfff1c2,emissive:0xffd77a,emissiveIntensity:.6,flatShading:true,transparent:true,opacity:.25,depthWrite:false})
  const plate=new T.Mesh(cube,new T.MeshStandardMaterial({color:0xb58c4a,roughness:.6,flatShading:true}))
  plate.scale.set(w,.1,d);plate.position.y=.05;g.add(plate)
  const part=(m,px,py,pz,sx,sy,sz)=>{const b=new T.Mesh(cube,m);b.position.set(px,py,pz);b.scale.set(sx,sy,sz);g.add(b);return b}
  for(const s of [-1,1]){
    part(gold,s*(w/2-.18),h/2,0,.36,h,.4)                    // pillars
    part(trim,s*(w/2-.18),h+.12,0,.5,.24,.5)                 // pillar caps
  }
  part(gold,0,h-.12,0,w,.24,.3)                              // top bar
  part(gold,0,.35,0,w-.4,.14,.22)                            // bottom bar
  const bars=7
  for(let i=1;i<bars;i++){
    const bx=-w/2+.36+(i/bars)*(w-.72)
    part(gold,bx,h/2,0,.09,h-.3,.09)                         // vertical bars
    part(trim,bx,h-.38,0,.2,.2,.2).rotation.set(Math.PI/4,0,Math.PI/4)  // diamond finials
  }
  const arch=new T.Mesh(new T.TorusGeometry(w*.32,.09,4,14,Math.PI),trim);arch.position.set(0,h-.05,0);arch.scale.y=.45;g.add(arch)
  let time=0
  function update(dt,cycle){
    time+=dt
    const on=cycle>=ERUPT_AT,warn=!on && cycle>=WARN_AT,k=warn?(cycle-WARN_AT)/(ERUPT_AT-WARN_AT):0
    // flicker: a fast sine plus random dropouts; faster and brighter while warning
    const flicker=(.6+.4*Math.sin(time*(warn?42:17)))*(Math.random()<(warn?.08:.15)?.3:1)
    const opacity=on?.84+.04*Math.sin(time*6):warn?(.12+.45*k)*(.55+.45*flicker):.05+.11*flicker
    gold.opacity=trim.opacity=opacity
    gold.color.copy(GHOST).lerp(SOLID,on?1:warn?k*.7:0)   // pale and ghostly when safe, deep gold when solid
    gold.emissiveIntensity=on?.45:.3+.35*flicker
    gold.depthWrite=trim.depthWrite=on
    const pop=on?1:.97+.03*flicker
    g.scale.set(1,pop,1)
  }
  return {group:g,update}
}
