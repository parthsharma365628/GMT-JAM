import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import emberUrl from './mc-sword.glb?url'
import cinderUrl from './cinder-sword.glb?url'
import seraphRapierUrl from './seraph-rapier.glb?url'
import wardenUrl from './boss-sword.glb?url'
import earthSwordUrl from './earth-sword.glb?url'
import earthStaffUrl from './earth-staff.glb?url'
import hellStaffUrl from './hell-staff.glb?url'
import heavenSwordUrl from './heaven-sword.glb?url'
import heavenStaffUrl from './heaven-staff.glb?url'

const loader=new GLTFLoader()
const models=new Map()

async function loadWeapon(key,url,pivot,rotation,length,sourceLength,spellTip=null){
  try{
    const {scene}=await loader.loadAsync(url)
    // Standardize the models to a palm-centered grip and a tip along +Y.
    const model=new T.Group()
    model.rotation.set(...rotation,'YXZ')
    model.scale.setScalar(length/sourceLength)
    if(key==='ember'){
      model.scale.y*=1.18
      model.scale.z*=1.45
    }
    scene.position.set(...pivot).negate()
    scene.traverse(node=>{
      if(!node.isMesh)return
      // Keep the blade readable in the arena's low light while retaining its texture.
      const material=node.material
      material.metalness=Math.min(material.metalness,.56)
      if(!material.emissiveMap && material.emissive.getHex()===0 && material.map){
        material.emissiveMap=material.map
        material.emissive.setHex(0xffffff)
        material.emissiveIntensity=key==='ember'?.32:.13
      }
    })
    if(spellTip){
      const origin=new T.Object3D()
      origin.name='spell-origin'
      origin.position.set(...spellTip)
      scene.add(origin)
    }
    model.add(scene)
    if(!spellTip)model.userData.swordModel=key
    models.set(key,model)
  }catch(error){
    console.warn('Using the placeholder weapon for '+key,error)
  }
}

export const weaponsReady=Promise.all([
  loadWeapon('ember',emberUrl,[.585,.03,0],[0,Math.PI/2,-Math.PI/2],1.60,1.7851),
  loadWeapon('cinder',cinderUrl,[.190,.0175,-.654],[-Math.PI/2,0,0],1.88,1.5015),
  loadWeapon('seraphRapier',seraphRapierUrl,[0,.035,-.555],[-Math.PI/2,0,0],1.53,1.60),
  loadWeapon('warden',wardenUrl,[-.045,.03,-.435],[-Math.PI/2,0,0],1.72,1.5672),
  loadWeapon('earthSword',earthSwordUrl,[.203,.043,.72],[Math.PI/2,0,0],1.72,1.3113),
  loadWeapon('earthStaff',earthStaffUrl,[0,.016,.10],[-Math.PI/2,0,0],2.72,2.026,[0,.016,1.08]),
  loadWeapon('hellStaff',hellStaffUrl,[0,-.95,0],[0,0,0],2.79,2.316,[0,.208,0]),
  loadWeapon('heavenSword',heavenSwordUrl,[-.0072,.026,.649],[Math.PI/2,0,0],1.74,1.76),
  loadWeapon('heavenStaff',heavenStaffUrl,[.1578,.98,-2.1748],[0,0,0],2.65,1.993,[.1578,1.933,-2.1748])
])

export function attachWeaponModel(parent,key,scale=1){
  const model=models.get(key)
  if(!model)return false
  const instance=model.clone(true)
  instance.scale.multiplyScalar(scale)
  parent.add(instance)
  return true
}

export function replaceWeaponModel(mount,key,scale=1){
  const placeholders=[...mount.children]
  if(attachWeaponModel(mount,key,scale))for(const placeholder of placeholders)placeholder.removeFromParent()
}
