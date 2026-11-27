import * as T from 'three'

// Makes the dungeon's instant-kill obstacles stand out: a pulsing rim glow in the realm's colour on every mesh
// (bright enough to bloom) and a glowing pool on the floor under each one.
// magma rocks glow red, Middle Earth bushes green, Heaven clouds gold.
export const HAZARD_GLOW={
  hell:{color:0xff2a0a,rim:3.2,base:.35},
  forest:{color:0x2dff5a,rim:2.4,base:.18},
  heaven:{color:0xff8a00,rim:1.6,base:.12,tint:0xffd27a}
}
const time={value:0}
const floorGeometry=new T.CircleGeometry(1,48)

function glowMaterial(source,glow){
  const material=source.clone()
  const color=new T.Color(glow.color)
  if(glow.tint)material.color?.multiply(new T.Color(glow.tint)) // e.g. Heaven's white clouds take on a gold body
  material.emissive=color.clone().multiplyScalar(glow.base)
  const original=source.onBeforeCompile
  material.onBeforeCompile=(shader,renderer)=>{
    original?.call(source,shader,renderer)
    shader.uniforms.glowTime=time
    shader.uniforms.glowColor={value:color}
    shader.uniforms.glowRim={value:glow.rim}
    shader.fragmentShader='uniform float glowTime;uniform vec3 glowColor;uniform float glowRim;\n'+shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      {
        float facing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
        float rim=pow(1.0-facing,2.2);
        float pulse=.75+.25*sin(glowTime*3.2);
        totalEmissiveRadiance+=glowColor*rim*glowRim*pulse;
      }`)
  }
  const key=source.customProgramCacheKey?.()??''
  material.customProgramCacheKey=()=>'hazard-glow|'+key
  return material
}

// Call on the arena's hazard group once it is built. Returns update(clock) for the pulse.
export function glowHazards(group,realm,hazards){
  const glow=HAZARD_GLOW[realm]
  const swapped=new Map()
  group.traverse(node=>{
    if(!node.isMesh)return
    const swap=m=>{if(!swapped.has(m))swapped.set(m,glowMaterial(m,glow));return swapped.get(m)}
    node.material=Array.isArray(node.material)?node.material.map(swap):swap(node.material)
  })
  const pool=new T.MeshBasicMaterial({color:glow.color,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending})
  pool.onBeforeCompile=shader=>{ // soft-edged disc
    shader.vertexShader='varying vec2 vDisc;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDisc=position.xy;')
    shader.fragmentShader='varying vec2 vDisc;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=pow(1.0-clamp(length(vDisc),0.0,1.0),1.6);\n#include <opaque_fragment>')
  }
  pool.customProgramCacheKey=()=>'hazard-pool'
  for(const h of hazards){
    const disc=new T.Mesh(floorGeometry,pool)
    disc.rotation.x=-Math.PI/2;disc.position.set(h.x,.03,h.z);disc.scale.set(h.rx*1.9,h.rz*1.9,1)
    group.add(disc)
  }
  return clock=>{time.value=clock;pool.opacity=.4+.15*Math.sin(clock*3.2)}
}
