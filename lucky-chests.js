import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import chestUrl from './chest.glb?url'

const chests=new Map()
const palette={hell:0xe33a37,earth:0x63ba42,heaven:0xf9bf43}
const realm=cfg=>cfg.celestial?'heaven':cfg.forest?'earth':'hell'
export const luckyChestColor=cfg=>palette[realm(cfg)]

function coloredMaterial(original,tint){
  const material=original.clone()
  material.metalness=Math.min(original.metalness,.62)
  material.onBeforeCompile=shader=>{
    shader.uniforms.chestTint={value:new T.Color(tint)}
    shader.fragmentShader='uniform vec3 chestTint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 originalColor=diffuseColor.rgb;
      float grain=dot(originalColor,vec3(0.2126,0.7152,0.0722));
      float trim=0.0;
      #ifdef USE_METALNESSMAP
        trim=texture2D(metalnessMap,vMetalnessMapUv).b;
      #endif
      vec3 painted=chestTint*(0.22+1.45*grain);
      diffuseColor.rgb=mix(painted,originalColor,0.07+trim*0.58);
    `).replace('#include <emissivemap_fragment>',`
      #include <emissivemap_fragment>
      totalEmissiveRadiance+=chestTint*(0.055+grain*0.22)*(1.0-trim*0.65);
    `)
  }
  return material
}

export const luckyChestsReady=new GLTFLoader().loadAsync(chestUrl).then(({scene})=>{
  // The source has a separate decorative dust mesh for opening the lid.
  const extras=[]
  scene.traverse(node=>{if(node.isMesh && /dust/i.test(node.userData.name??node.name))extras.push(node)})
  for(const node of extras)node.removeFromParent()
  const bounds=new T.Box3().setFromObject(scene,true)
  const center=bounds.getCenter(new T.Vector3())
  const width=bounds.max.x-bounds.min.x
  if(!(width>0))throw new Error('Lucky Chest model has no visible geometry')
  scene.position.sub(center)
  for(const [key,tint] of Object.entries(palette)){
    const chest=new T.Group(),model=scene.clone(true),materials=new Map()
    model.traverse(node=>{
      if(!node.isMesh)return
      if(!materials.has(node.material))materials.set(node.material,coloredMaterial(node.material,tint))
      node.material=materials.get(node.material)
    })
    chest.add(model)
    chest.scale.setScalar(1.28/width)
    chests.set(key,chest)
  }
}).catch(error=>console.warn('Using simple Lucky Box meshes',error))

export function luckyChest(cfg){return chests.get(realm(cfg))?.clone(true)}
