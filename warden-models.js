import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {animateCharacter} from './character.js'
import hellUrl from './hell-warden.glb?url'
import earthUrl from './earth-boss.glb?url'
import heavenUrl from './heaven-boss.glb?url'

const wardens={
  hell:{url:hellUrl,colors:{rusher:[0xffb89b,0xd997af],shooter:[0xc5b6ff],brute:[0xffce91]}},
  earth:{url:earthUrl,colors:{rusher:[0xe8efd3,0xc9dbac],shooter:[0xbacfe8],brute:[0xf2d1a5]},weaponScales:[.60,.54]},
  heaven:{url:heavenUrl,colors:{rusher:[0xf7e3be,0xf0cade],shooter:[0xcddcff,0xe1d2f8],brute:[0xffdfbc]},weaponScales:[.43,.41]}
}
const materials=new Map()
const loader=new GLTFLoader()

export const wardensReady=Promise.all(Object.entries(wardens).map(async ([name,warden])=>{
  try{
    const {scene}=await loader.loadAsync(warden.url)
    warden.template=scene
  }catch(error){
    console.warn('Could not load the '+name+' guardian model',error)
  }
}))

export function animateWarden(name,actor,height,type,variant=0){
  const {template,colors,weaponScales}=wardens[name]
  if(!template)return null
  const palette=colors[type]
  const tint=palette?.[variant%palette.length]
  const materialFor=tint?source=>{
    const key=name+':'+tint
    if(!materials.has(key)){
      const material=source.clone()
      material.color.setHex(tint)
      materials.set(key,material)
    }
    return materials.get(key)
  }:null
  const weapon=actor.userData.weapon
  const fittedSword=Boolean(weapon.children[0]?.userData.swordModel)
  const fittedStaff=Boolean(weapon.getObjectByName('spell-origin'))
  return animateCharacter(actor,{
    template,targetHeight:height,materialFor,
    crossGrip:type!=='shooter'||fittedStaff,
    wardenFist:type===undefined||fittedSword||fittedStaff||(name==='earth'&&type!=='shooter'),
    weaponScale:weaponScales?.[type===undefined?0:1]
  })
}
