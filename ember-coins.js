import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import coinUrl from './coin.glb?url'

let template
const fallbackGeometry=new T.OctahedronGeometry(.34)
const fallbackMaterial=new T.MeshStandardMaterial({color:0xffd75b,emissive:0xffa62b,emissiveIntensity:.5})

export const emberCoinsReady=new GLTFLoader().loadAsync(coinUrl).then(({scene})=>{
  const bounds=new T.Box3().setFromObject(scene,true)
  const size=bounds.getSize(new T.Vector3())
  const diameter=Math.max(size.x,size.z)
  if(!(diameter>0))throw new Error('The Ember coin has no visible geometry')
  scene.position.sub(bounds.getCenter(new T.Vector3()))
  scene.traverse(node=>{
    if(!node.isMesh)return
    const material=node.material
    material.metalness=Math.min(material.metalness,.40)
    material.emissive.setHex(0xffb53e)
    material.emissiveIntensity=.25
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        float relief=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
        diffuseColor.rgb=vec3(1.0,0.63,0.11)*(0.35+1.4*relief);
      `)
    }
  })
  const coin=new T.Group()
  coin.rotation.x=Math.PI/2-.14
  coin.scale.setScalar(.72/diameter)
  coin.add(scene)
  template=new T.Group()
  template.add(coin)
}).catch(error=>console.warn('Using the fallback Ember mesh',error))

export function emberCoin(){return template?.clone(true)??new T.Mesh(fallbackGeometry,fallbackMaterial)}
