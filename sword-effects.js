import * as T from 'three'

const styles={
  cinder:{start:.42,tip:1.66,rate:37,snow:false},
  seraphRapier:{start:.33,tip:1.27,rate:29,snow:true}
}
const capacity=48
const trailSegments=18, trailLife=.2

function createTrail(scene){
  const positions=new Float32Array(trailSegments*6)
  const coordinates=new Float32Array(trailSegments*4)
  const geometry=new T.BufferGeometry()
  const vertices=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage)
  const uv=new T.BufferAttribute(coordinates,2).setUsage(T.DynamicDrawUsage)
  const indices=[]
  for(let i=0;i<trailSegments-1;i++){
    const a=i*2
    indices.push(a,a+1,a+2,a+1,a+3,a+2)
  }
  geometry.setAttribute('position',vertices)
  geometry.setAttribute('uv',uv)
  geometry.setIndex(indices)
  geometry.setDrawRange(0,0)
  const snow={value:false}
  const material=new T.ShaderMaterial({
    uniforms:{snow},transparent:true,side:T.DoubleSide,depthWrite:false,
    vertexShader:`
      varying vec2 trailUv;
      void main(){
        trailUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      uniform bool snow;
      varying vec2 trailUv;
      void main(){
        float width=trailUv.x;
        float age=trailUv.y;
        float ripple=0.5+0.5*sin(age*37.0+width*19.0);
        float rim=smoothstep(0.69,0.95,width);
        vec3 edge=snow?vec3(0.04,0.33,0.9):vec3(1.0,0.055,0.005);
        vec3 core=snow?vec3(0.84,0.97,1.0):vec3(1.0,0.77,0.24);
        vec3 tint=mix(edge,core,rim*0.9+ripple*0.1);
        float opacity=smoothstep(0.02,0.68,width)*(1.0-smoothstep(0.95,1.0,width));
        gl_FragColor=vec4(tint,opacity*pow(1.0-age,1.4)*(0.65+0.35*ripple));
        #include <colorspace_fragment>
      }
    `
  })
  const mesh=new T.Mesh(geometry,material)
  mesh.frustumCulled=false
  scene.add(mesh)
  const samples=Array.from({length:trailSegments},()=>({age:trailLife,base:new T.Vector3(),tip:new T.Vector3()}))
  let next=0,previousProgress=0

  return (dt,mount,style,progress,changed)=>{
    if(changed || (progress>0 && progress<previousProgress)){
      for(const sample of samples)sample.age=trailLife
    }
    previousProgress=progress
    for(const sample of samples)sample.age+=dt
    if(style && progress>.12 && progress<.86){
      const sample=samples[next]
      const previous=samples[(next+trailSegments-1)%trailSegments]
      sample.base.set(0,style.tip*.43,0).applyMatrix4(mount.matrixWorld)
      sample.tip.set(0,style.tip*1.06,0).applyMatrix4(mount.matrixWorld)
      if(previous.age>=trailLife || previous.tip.distanceToSquared(sample.tip)>.0004){
        sample.age=0
        next=(next+1)%trailSegments
      }
    }
    let count=0
    for(let i=0;i<trailSegments;i++){
      const sample=samples[(next+i)%trailSegments]
      if(sample.age>=trailLife)continue
      sample.base.toArray(positions,count*6)
      sample.tip.toArray(positions,count*6+3)
      const age=sample.age/trailLife
      coordinates.set([0,age,1,age],count*4)
      count++
    }
    if(style)snow.value=style.snow
    geometry.setDrawRange(0,Math.max(0,count-1)*6)
    vertices.needsUpdate=uv.needsUpdate=true
  }
}

export function createSwordEffects(scene,player,renderer){
  const trail=createTrail(scene)
  const positions=new Float32Array(capacity*3)
  const appearances=new Float32Array(capacity*3)
  const geometry=new T.BufferGeometry()
  const positionAttribute=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage)
  const appearanceAttribute=new T.BufferAttribute(appearances,3).setUsage(T.DynamicDrawUsage)
  geometry.setAttribute('position',positionAttribute)
  geometry.setAttribute('appearance',appearanceAttribute)
  const uniforms={viewportHeight:{value:1},snow:{value:false}}
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,
    vertexShader:`
      uniform float viewportHeight;
      attribute vec3 appearance;
      varying vec2 fadeAndTint;
      void main(){
        vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*viewPosition;
        gl_PointSize=clamp(appearance.x*viewportHeight*projectionMatrix[1][1]/(2.0*max(0.1,-viewPosition.z)),1.0,38.0);
        fadeAndTint=appearance.yz;
      }
    `,
    fragmentShader:`
      uniform bool snow;
      varying vec2 fadeAndTint;
      void main(){
        vec2 p=gl_PointCoord-0.5;
        float radius=length(p);
        float halo=1.0-smoothstep(0.06,0.50,radius);
        float core=1.0-smoothstep(0.025,0.15,radius);
        vec3 color;
        float opacity;
        if(snow){
          float angle=atan(p.y,p.x+0.0001)+fadeAndTint.y*6.283;
          float arms=pow(abs(cos(angle*3.0)),9.0)*(1.0-smoothstep(0.15,0.42,radius));
          color=mix(vec3(0.075,0.47,0.85),vec3(0.88,0.98,1.0),max(core,arms));
          opacity=halo*0.25+max(core,arms)*0.75;
        }else{
          color=mix(vec3(1.0,0.07,0.008),vec3(1.0,0.83,0.22),mix(core,1.0,fadeAndTint.y*0.25));
          opacity=halo*halo*0.65+core*0.35;
        }
        gl_FragColor=vec4(color,opacity*fadeAndTint.x);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  })
  const points=new T.Points(geometry,material)
  points.frustumCulled=false
  points.visible=false
  scene.add(points)
  const glow=new T.PointLight(0xff641c,0,3)
  scene.add(glow)

  const particles=Array.from({length:capacity},()=>({
    position:new T.Vector3(),velocity:new T.Vector3(),age:0,life:0,size:0,tint:0
  }))
  let lastBlade,next=0,credit=0
  const jitter=range=>(Math.random()-.5)*range

  return (dt,attackProgress)=>{
    const mount=player.userData.weapon
    const blade=mount?.children[0]
    const style=styles[blade?.userData.swordModel]
    const changed=blade!==lastBlade
    if(changed){
      for(const particle of particles)particle.life=0
      credit=0
      lastBlade=blade
    }
    points.visible=Boolean(style)
    glow.intensity=0
    if(!style){
      geometry.setDrawRange(0,0)
      trail(dt,null,null,0,changed)
      return
    }

    uniforms.snow.value=style.snow
    uniforms.viewportHeight.value=renderer.domElement.height
    mount.updateWorldMatrix(true,false)
    trail(dt,mount,style,player.visible?attackProgress:0,changed)
    if(player.visible){
      if(!style.snow){
        glow.position.set(0,.95,0).applyMatrix4(mount.matrixWorld)
        glow.intensity=1.35
      }
      credit+=dt*style.rate
      while(credit>=1){
        credit--
        const particle=particles[next]
        next=(next+1)%capacity
        particle.position.set(jitter(.16),T.MathUtils.lerp(style.start,style.tip,Math.random()),jitter(.14))
          .applyMatrix4(mount.matrixWorld)
        particle.velocity.set(jitter(.58),style.snow?-.44+Math.random()*.27:.63+Math.random()*.59,jitter(.58))
        particle.age=0
        particle.life=.33+Math.random()*(style.snow?.59:.33)
        particle.size=(style.snow?.10:.14)+Math.random()*(style.snow?.10:.18)
        particle.tint=Math.random()
      }
    }

    let count=0
    for(const particle of particles){
      particle.age+=dt
      if(particle.age>=particle.life)continue
      particle.position.addScaledVector(particle.velocity,dt)
      const progress=particle.age/particle.life
      const offset=count++*3
      particle.position.toArray(positions,offset)
      appearances[offset]=particle.size*(1-progress*.5)
      appearances[offset+1]=Math.min(1,progress*12)*(1-progress)**1.3
      appearances[offset+2]=particle.tint
    }
    geometry.setDrawRange(0,count)
    positionAttribute.needsUpdate=appearanceAttribute.needsUpdate=true
  }
}
