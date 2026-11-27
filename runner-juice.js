import * as T from 'three'

// Runner "game juice": glowing ribbon trails from the hands and feet, pooled spark particles, landing shockwaves,
// and camera feel (speed FOV, strafe roll, trauma shake, landing dip, hit-stop / slow motion).
// main.js drives it: update() once per frame after frameCamera(), events (jump, land, death, ...) as they happen.

export const PALETTES={
  hell:{core:0xfff1a8,edge:0xff3608,sparks:[0xffb347,0xff5a1f,0xffe08a,0xff2a00],ring:0xff7a2a,lines:'255,176,96',flash:'255,60,20'},
  forest:{core:0xf0ffd2,edge:0x22c46c,sparks:[0xb8f27a,0x6fdc8c,0xffe38a,0x41e0b0],ring:0xa8ef84,lines:'226,255,206',flash:'255,70,40'},
  heaven:{core:0xfff3c4,edge:0xf0a020,additive:false,sparks:[0xfff2b8,0xbfe8ff,0xffd36e,0xffffff],ring:0xffe7a0,lines:'255,250,232',flash:'255,80,60'}
}
export const realmOf=cfg=>cfg.celestial?'heaven':cfg.forest?'forest':'hell'

const UP=new T.Vector3(0,1,0),tmp=new T.Vector3(),tmp2=new T.Vector3(),side=new T.Vector3(),tangent=new T.Vector3(),toEye=new T.Vector3()

// Camera-facing ribbon that follows a moving point. Samples stay in world space, so the trail stretches behind
// the runner on its own. The head sample is pinned to the emitter; a new sample is committed every `spacing` units.
function ribbon(scene,{capacity=64,life=.4,width=.2,spacing=.12,flat=true}){
  const pos=new Float32Array(capacity*6),uv=new Float32Array(capacity*4)
  const geometry=new T.BufferGeometry()
  const position=new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage),coords=new T.BufferAttribute(uv,2).setUsage(T.DynamicDrawUsage)
  const index=[];for(let i=0;i<capacity-1;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2)}
  geometry.setAttribute('position',position);geometry.setAttribute('uv',coords);geometry.setIndex(index);geometry.setDrawRange(0,0)
  const uniforms={core:{value:new T.Color()},edge:{value:new T.Color()},boost:{value:1},time:{value:0},additive:{value:1}}
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      uniform vec3 core;uniform vec3 edge;uniform float boost;uniform float time;uniform float additive;varying vec2 vUv;
      void main(){
        float across=1.0-abs(vUv.x*2.0-1.0);
        float age=vUv.y;
        float hot=pow(across,2.6)*(1.0-age*.75);
        float flick=.78+.22*sin(age*46.0-time*38.0+vUv.x*7.0);
        vec3 col=mix(edge,core,clamp(hot*1.4,0.0,1.0));
        float a=smoothstep(0.0,.5,across)*pow(1.0-age,1.3)*flick*boost;
        gl_FragColor=additive>.5?vec4(col*a*(1.0+hot*1.5),a):vec4(col,min(1.0,a*.85));
        #include <colorspace_fragment>
      }`
  })
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=5;scene.add(mesh)
  const pts=Array.from({length:capacity},()=>({p:new T.Vector3(),age:life}))
  let count=0 // pts[0] is the head (newest)
  return {
    uniforms,material,
    reset(){count=0;geometry.setDrawRange(0,0)},
    update(dt,head,emit,eye,widthScale=1){
      for(let i=0;i<count;i++)pts[i].age+=dt
      while(count>0 && pts[count-1].age>=life)count--
      if(emit){
        if(count<2 || pts[1].p.distanceTo(head)>spacing){
          const last=pts[capacity-1] // shift the ring down one place (cheap for 64 entries)
          for(let i=capacity-1;i>0;i--)pts[i]=pts[i-1]
          pts[0]=last;count=Math.min(capacity,count+1)
        }
        pts[0].p.copy(head);pts[0].age=0
      }
      if(count<2){geometry.setDrawRange(0,0);return}
      for(let i=0;i<count;i++){
        const a=pts[Math.max(0,i-1)].p,b=pts[Math.min(count-1,i+1)].p,p=pts[i].p
        tangent.subVectors(a,b);if(tangent.lengthSq()<1e-8)tangent.set(0,0,1)
        // Flat ribbons lie level like light streaks, so a chase camera behind the runner sees their full length.
        // They fall back to facing the camera where the path is near vertical.
        if(flat)side.crossVectors(tangent,UP)
        if(!flat || side.lengthSq()<.04*tangent.lengthSq()){toEye.subVectors(eye,p);side.crossVectors(tangent,toEye)}
        side.normalize()
        const t=Math.min(1,pts[i].age/life),w=width*widthScale*(1-t*.65)*(i===0?.6:1)
        tmp.copy(p).addScaledVector(side,w).toArray(pos,i*6)
        tmp.copy(p).addScaledVector(side,-w).toArray(pos,i*6+3)
        uv[i*4]=0;uv[i*4+1]=t;uv[i*4+2]=1;uv[i*4+3]=t
      }
      position.needsUpdate=coords.needsUpdate=true
      geometry.setDrawRange(0,(count-1)*6)
    }
  }
}

// Pooled additive spark points with per-particle colour, size, gravity and drag.
function sparks(scene,capacity=1200){
  const pos=new Float32Array(capacity*3),col=new Float32Array(capacity*3),alpha=new Float32Array(capacity),size=new Float32Array(capacity)
  const vel=new Float32Array(capacity*3),life=new Float32Array(capacity),max=new Float32Array(capacity),grav=new Float32Array(capacity),drag=new Float32Array(capacity),size0=new Float32Array(capacity)
  const geometry=new T.BufferGeometry()
  const aPos=new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage),aAlpha=new T.BufferAttribute(alpha,1).setUsage(T.DynamicDrawUsage)
  const aSize=new T.BufferAttribute(size,1).setUsage(T.DynamicDrawUsage),aCol=new T.BufferAttribute(col,3).setUsage(T.DynamicDrawUsage)
  geometry.setAttribute('position',aPos);geometry.setAttribute('color',aCol);geometry.setAttribute('alpha',aAlpha);geometry.setAttribute('size',aSize)
  const uniforms={scale:{value:400}}
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,
    vertexShader:`
      uniform float scale;attribute float alpha;attribute float size;varying float vA;varying vec3 vC;
      void main(){vA=alpha;vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`
      varying float vA;varying vec3 vC;
      void main(){
        float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;
        float glow=pow(1.0-d,1.8);float hot=pow(1.0-d,8.0);
        vec3 c=mix(vC,vec3(1.0),hot*.8);
        gl_FragColor=vec4(c*glow*vA,glow*vA);
        #include <colorspace_fragment>
      }`
  })
  const points=new T.Points(geometry,material);points.frustumCulled=false;points.renderOrder=6;scene.add(points)
  let cursor=0
  const color=new T.Color()
  function spawn(p,vx,vy,vz,{life:l=.6,size:s=.18,gravity=-9,drag:dr=1.5,color:c=0xffffff}={}){
    const i=cursor;cursor=(cursor+1)%capacity
    pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z
    vel[i*3]=vx;vel[i*3+1]=vy;vel[i*3+2]=vz
    color.set(Array.isArray(c)?c[(Math.random()*c.length)|0]:c);col[i*3]=color.r;col[i*3+1]=color.g;col[i*3+2]=color.b
    life[i]=max[i]=l*(.7+Math.random()*.6);grav[i]=gravity;drag[i]=dr;size0[i]=s*(.6+Math.random()*.8)
    aCol.needsUpdate=true
  }
  return {
    uniforms,spawn,
    burst(p,count,{speed=4,up=2,spread=1,dir=null,...opts}={}){
      for(let n=0;n<count;n++){
        tmp2.set(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize().multiplyScalar(speed*(.35+Math.random()*.65)*spread)
        if(dir)tmp2.addScaledVector(dir,speed)
        spawn(p,tmp2.x,tmp2.y+up*(.5+Math.random()*.5),tmp2.z,opts)
      }
    },
    clear(){life.fill(0);alpha.fill(0);aAlpha.needsUpdate=true},
    update(dt){
      for(let i=0;i<capacity;i++){
        if(life[i]<=0){if(alpha[i]){alpha[i]=0;size[i]=0}continue}
        life[i]-=dt
        const k=Math.exp(-drag[i]*dt)
        vel[i*3]*=k;vel[i*3+1]=vel[i*3+1]*k+grav[i]*dt;vel[i*3+2]*=k
        pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt
        const t=Math.max(0,life[i]/max[i])
        alpha[i]=t<.25?t*4:1;size[i]=size0[i]*(.35+.65*t)
      }
      aPos.needsUpdate=aAlpha.needsUpdate=aSize.needsUpdate=true
    }
  }
}

// Flat expanding shockwave rings (landing, jump, pickups).
function rings(scene,count=8){
  const geometry=new T.CircleGeometry(1,96)
  const pool=Array.from({length:count},()=>{
    const uniforms={color:{value:new T.Color()},t:{value:1}}
    const mesh=new T.Mesh(geometry,new T.ShaderMaterial({
      uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
      vertexShader:`varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`
        uniform vec3 color;uniform float t;varying vec2 vP;
        void main(){float r=length(vP);float band=exp(-pow((r-.86)/(.05+t*.05),2.0));float hot=exp(-pow((r-.86)/.018,2.0));
        float a=(band*.8+hot*.6)*(1.0-t)*(1.0-t);gl_FragColor=vec4(mix(color,vec3(1.0),hot*.6)*a,a);
        #include <colorspace_fragment>
        }`
    }))
    mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.renderOrder=4;scene.add(mesh)
    return {mesh,uniforms,age:1,life:.45,size:3}
  })
  let next=0
  return {
    spawn(p,{color=0xffffff,size=3,life=.45}={}){
      const r=pool[next];next=(next+1)%count
      r.mesh.position.copy(p);r.mesh.position.y+=.06;r.uniforms.color.value.set(color);r.age=0;r.life=life;r.size=size;r.mesh.visible=true
    },
    update(dt){
      for(const r of pool){
        if(!r.mesh.visible)continue
        r.age+=dt;const t=Math.min(1,r.age/r.life)
        r.uniforms.t.value=t;r.mesh.scale.setScalar(.25+r.size*(1-(1-t)**3))
        if(t>=1)r.mesh.visible=false
      }
    }
  }
}

export function createRunnerJuice(scene,camera,player,renderer){
  const bone=name=>player.getObjectByName(T.PropertyBinding.sanitizeNodeName('DEF-'+name))
  const fallback={'foot.L':[-.14,.12,0],'foot.R':[.14,.12,0],'hand.L':[-.45,1.05,0],'hand.R':[.45,1.05,0]}
  const emitters=[
    {name:'foot.L',trail:ribbon(scene,{width:.28,life:.6}),foot:true},
    {name:'foot.R',trail:ribbon(scene,{width:.28,life:.6}),foot:true},
    {name:'hand.L',trail:ribbon(scene,{width:.12,life:.38,flat:false})},
    {name:'hand.R',trail:ribbon(scene,{width:.12,life:.38,flat:false})}
  ].map(e=>({...e,pos:new T.Vector3(),last:new T.Vector3()}))
  const fx=sparks(scene),wave=rings(scene)
  const lines=document.querySelector('#speedlines'),flashEl=document.querySelector('#flash')
  let palette=PALETTES.hell,trauma=0,fovKick=0,dip=0,roll=0,fov=camera.fov,flash=0,flashColor='255,60,20'
  let hitstop=0,slow=0,lineAngle=0,lineLevel=-1,sparkCredit=0,time=0
  const baseFov=camera.fov

  function where(e,out){
    const b=e.bone??=bone(e.name)
    if(b)return b.getWorldPosition(out)
    return player.localToWorld(out.set(...fallback[e.name]))
  }
  function setRealm(realm){
    palette=PALETTES[realm]??PALETTES.hell
    for(const e of emitters){
      e.trail.uniforms.core.value.set(palette.core);e.trail.uniforms.edge.value.set(palette.edge)
      // Additive light washes out on Heaven's white floor, so there the trail is painted gold instead.
      const additive=palette.additive!==false
      e.trail.uniforms.additive.value=additive?1:0;e.trail.material.blending=additive?T.AdditiveBlending:T.NormalBlending
    }
    lines?.style.setProperty('--c',palette.lines)
  }
  setRealm('hell')

  const feet=new T.Vector3()
  const playerFeet=()=>feet.copy(player.position)
  return {
    setRealm,
    get palette(){return palette},
    reset(){for(const e of emitters)e.trail.reset();fx.clear()},
    shake(amount){trauma=Math.min(1,trauma+amount)},
    kick(amount){fovKick+=amount},
    flash(amount,color=palette.flash){flash=Math.max(flash,amount);flashColor=color},
    hitstop(seconds){hitstop=Math.max(hitstop,seconds)},
    slowmo(seconds){slow=Math.max(slow,seconds)},
    // Scales the game's dt for hit-stop and slow motion. Call once per frame with the real dt.
    scaleDt(dt){
      if(hitstop>0){hitstop-=dt;return 0}
      if(slow>0){slow-=dt;return dt*.35}
      return dt
    },
    jump(){
      const p=playerFeet()
      fx.burst(p,22,{speed:4,up:1.2,color:palette.sparks,life:.45,size:.16,gravity:-6})
      wave.spawn(p,{color:palette.ring,size:2.2,life:.35})
      fovKick+=4
    },
    land(impact=1){
      const p=playerFeet()
      fx.burst(p,Math.round(20+impact*18),{speed:5.5*impact,up:2,color:palette.sparks,life:.55,size:.2,gravity:-12})
      wave.spawn(p,{color:palette.ring,size:2.4*impact,life:.4})
      trauma=Math.min(1,trauma+.22*impact);dip=Math.min(1,dip+.8*impact)
    },
    pickup(pos,big=false){
      fx.burst(pos,big?70:26,{speed:big?7:4.5,up:big?4:2,color:[0xffe27a,0xffc23d,0xfff6cf],life:big?.9:.5,size:big?.26:.18,gravity:-5,drag:2.4})
      wave.spawn(pos.clone().setY(Math.max(.05,pos.y-.9)),{color:0xffd35e,size:big?4.5:1.8,life:big?.6:.3})
      if(big){trauma=Math.min(1,trauma+.25);fovKick+=6}
    },
    nearMiss(pos){
      fx.burst(pos,20,{speed:6,up:1,color:[0xffffff,palette.core],life:.35,size:.14,gravity:0,drag:4})
      fovKick+=3
    },
    death(){
      const p=tmp.copy(player.position);p.y+=1
      fx.burst(p,90,{speed:9,up:3,color:palette.sparks,life:.9,size:.26,gravity:-10,drag:1.6})
      wave.spawn(player.position,{color:palette.ring,size:5,life:.6})
      trauma=1;flash=Math.max(flash,.75);flashColor=palette.flash;hitstop=Math.max(hitstop,.11)
    },
    // speed: 0..1 run pace; running: grounded and moving; trails: emit trails (third person only)
    update(dt,{active,speed=0,running=false,airborne=false,trails=true,fp=false}){
      time+=dt
      const eye=camera.position
      for(const e of emitters){
        const on=active && trails && (e.foot || speed>.18)
        if(on){e.last.copy(e.pos);where(e,e.pos)}
        const boost=e.foot?1+speed*1.1+(airborne?.5:0):Math.min(1.4,(speed-.18)*2)
        e.trail.uniforms.boost.value=boost;e.trail.uniforms.time.value=time
        e.trail.update(dt,e.pos,on,eye,e.foot?(.8+speed*.6):1)
      }
      // Footfall sparks kicked backwards off the ground while running.
      if(active && running){
        sparkCredit+=dt*(10+speed*55)*(fp?.5:1)
        while(sparkCredit>=1){
          sparkCredit--
          const e=emitters[Math.random()<.5?0:1],p=where(e,tmp2)
          p.y=Math.max(.05,p.y)
          const back=Math.random()*2+1+speed*3
          const h=player.rotation.y,fx_=Math.sin(h)*back,fz=Math.cos(h)*back // backwards = -forward
          fx.spawn(p,fx_+(Math.random()-.5)*1.5,1+Math.random()*2.5,fz+(Math.random()-.5)*1.5,{color:palette.sparks,life:.4,size:.1+speed*.08,gravity:-9,drag:1.2})
        }
      }else sparkCredit=0
      fx.uniforms.scale.value=renderer.domElement.height*.5/Math.tan(T.MathUtils.degToRad(camera.fov)*.5)
      fx.update(dt);wave.update(dt)

      // Speed lines overlay
      const level=active?T.MathUtils.clamp((speed-.2)/.8,0,1)*(fp?1:.75)+Math.min(.4,fovKick*.04):0
      if(lines){
        lineAngle=(lineAngle+97.3)%360
        if(level>.01||lineLevel>0){lines.style.setProperty('--a',lineAngle.toFixed(1)+'deg');lines.style.opacity=level.toFixed(3)}
        lineLevel=level
      }
      if(flashEl){flash=Math.max(0,flash-dt*2.2);flashEl.style.background=flash>0?`radial-gradient(circle at 50% 50%,rgba(${flashColor},0) 35%,rgba(${flashColor},${flash*.7}))`:'none'}
    },
    // Applied after camera.lookAt in frameCamera: FOV, roll, rotational shake and landing dip.
    camera(dt,{active,speed=0,strafe=0,fp=false,fpBlend=0}){
      const target=(active?baseFov+fpBlend*16+speed*(10+fpBlend*6):baseFov)
      fovKick=Math.max(0,fovKick-dt*fovKick*5-dt*.5)
      fov=T.MathUtils.damp(fov,target+fovKick,4,dt)
      if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix()}
      roll=T.MathUtils.damp(roll,active?-strafe*(.0035+fpBlend*.004):0,8,dt)
      camera.rotateZ(roll)
      dip=Math.max(0,dip-dt*4)
      if(dip>0)camera.rotateX(-Math.sin(dip*Math.PI)*.05*(1+fpBlend))
      trauma=Math.max(0,trauma-dt*1.6)
      const s=trauma*trauma
      if(s>0){
        camera.rotateX((Math.random()-.5)*s*.09);camera.rotateY((Math.random()-.5)*s*.09);camera.rotateZ((Math.random()-.5)*s*.07)
      }
    }
  }
}
