import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import fingerUrl from './lava-finger.glb?url'

let variants,material
export const pillarsReady=new GLTFLoader().loadAsync(fingerUrl).then(({scene})=>{
  let mesh
  scene.traverse(node=>{if(node.isMesh)mesh=node})
  if(!mesh)throw new Error('The lava pillar model contains no mesh')

  // The supplied mesh runs along +Z, with the taper and nail at the far end.
  const upright=mesh.geometry.clone().rotateX(-Math.PI/2)
  upright.computeBoundingBox()
  const bounds=upright.boundingBox
  const center=bounds.getCenter(new T.Vector3())
  const height=bounds.max.y-bounds.min.y
  upright.translate(-center.x,-bounds.min.y,-center.z).scale(1/height,1/height,1/height)
  const normal=new T.Vector3()
  variants=[-.13,-.07,.065,.12].map((bend,variant)=>{
    const geometry=upright.clone()
    const positions=geometry.attributes.position, normals=geometry.attributes.normal
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i)
      const shift=bend*y*y
      const ripple=.006*Math.sin(x*33+y*31+variant)*Math.cos(z*39-y*21)
      positions.setXYZ(i,x+shift+ripple,y,z+shift*.45+ripple)
      if(normals){
        normal.fromBufferAttribute(normals,i)
        normal.y-=2*bend*y*(normal.x+.45*normal.z)
        normal.normalize()
        normals.setXYZ(i,normal.x,normal.y,normal.z)
      }
    }
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  })
  material=mesh.material.clone()
  material.emissiveIntensity=.18
  // Retain any cutout edges without sorting hundreds of translucent pillars.
  if(material.transparent){
    material.transparent=false
    material.alphaTest=.35
    material.depthWrite=true
  }
}).catch(error=>console.warn('Could not load the lava pillar model',error))

const noise=seed=>{
  const n=Math.sin(seed*127.1+311.7)*43758.5453
  return n-Math.floor(n)
}

export function fingerPillar(parent,side,z,seed){
  if(!variants)return false
  const mesh=new T.Mesh(variants[Math.floor(noise(seed)*variants.length)],material)
  const height=7.9+noise(seed+1)*2.7
  const width=height*(.77+noise(seed+2)*.13)
  mesh.position.set(side*(6.45+noise(seed+3)*.65),-4.86,z+(noise(seed+4)-.5)*1.05)
  mesh.rotation.set((noise(seed+5)-.5)*.2,noise(seed+6)*Math.PI*2,-side*(.025+noise(seed+7)*.12),'YXZ')
  mesh.scale.set(width,height,width)
  parent.add(mesh)
  return true
}
