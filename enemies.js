import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {box,sword} from './world.js'
import {animateWarden} from './warden-models.js'
import {replaceWeaponModel} from './weapon-models.js'

const loader=new GLTFLoader()
const modelCache=new Map()
const forward=new T.Vector3(), diff=new T.Vector3()
const spellOrigin=new T.Vector3(), spellDirection=new T.Vector3()
const spellGlowGeometry=new T.IcosahedronGeometry(.14,1)
const spellGlowMaterials={
  hell:new T.MeshBasicMaterial({color:0xff713d}),
  earth:new T.MeshBasicMaterial({color:0xb0fb91})
}

function face(model,dir){model.rotation.y=Math.atan2(-dir.x,-dir.z)}
function facing(model){return forward.set(-Math.sin(model.rotation.y),0,-Math.cos(model.rotation.y))}

// Loads an optional .glb model if modelUrl is provided; otherwise keeps the blocky 3D fallback.
function attachModel(root,modelUrl,targetHeight,buildFallback){
  const fallback=buildFallback(root)
  if(!modelUrl)return
  if(!modelCache.has(modelUrl)){
    modelCache.set(modelUrl,loader.loadAsync(modelUrl).then(({scene})=>{
      scene.updateMatrixWorld(true)
      const bounds=new T.Box3().setFromObject(scene,true)
      const h=Math.max(.01,bounds.max.y-bounds.min.y)
      const center=bounds.getCenter(new T.Vector3())
      const wrapper=new T.Group()
      const clone=scene.clone(true)
      clone.position.set(-center.x,-bounds.min.y,-center.z)
      wrapper.add(clone)
      wrapper.scale.setScalar(targetHeight/h)
      return wrapper
    }))
  }
  modelCache.get(modelUrl).then(template=>{
    if(!root.parent)return
    fallback.removeFromParent()
    root.add(template.clone(true))
  }).catch(err=>console.warn('Using blocky fallback for enemy model:',err))
}

function buildRusherMesh(parent){
  const g=new T.Group();parent.add(g)
  box(g,0,.65,0,.65,.95,.45,0x8f2d2d)   // torso
  box(g,0,1.32,0,.46,.44,.44,0x2a1d24)  // head
  box(g,0,1.31,-.23,.34,.09,.05,0xff9429) // glowing eyes
  for(const s of [-1,1]){
    box(g,s*.2,.14,0,.22,.28,.3,0x1f1820)
    box(g,s*.38,.95,0,.24,.26,.36,0xb84739)
  }
  g.userData.weapon=sword(g,.46,.65,-.18)
  g.userData.weapon.scale.setScalar(.72)
  return g
}

function buildShooterMesh(parent){
  const g=new T.Group();parent.add(g)
  box(g,0,.78,0,.7,1.25,.55,0x4c295c)   // robe
  box(g,0,1.62,0,.48,.48,.48,0x251a2e)  // hood
  box(g,0,1.60,-.25,.34,.09,.05,0xd45bff) // eyes
  for(const s of [-1,1]){
    box(g,s*.44,1.15,0,.26,.28,.4,0x6d3b7d)
  }
  const staff=new T.Group();staff.position.set(.52,.9,-.2);g.add(staff)
  box(staff,0,0,0,.1,1.4,.1,0x59372c)
  box(staff,0,.8,0,.28,.28,.28,0xff66cc)
  g.userData.weapon=staff
  return g
}

function buildBruteMesh(parent){
  const g=new T.Group();parent.add(g)
  box(g,0,.95,0,1.15,1.45,.8,0x5c2722)
  box(g,0,1.92,0,.68,.62,.64,0x231d26)
  box(g,0,1.90,-.33,.5,.12,.06,0xff451c)
  for(const s of [-1,1]){
    box(g,s*.34,.22,0,.42,.44,.5,0x29212b)
    box(g,s*.68,1.4,0,.48,.45,.68,0x944834)
  }
  g.userData.weapon=sword(g,.78,.95,-.25)
  g.userData.weapon.scale.setScalar(1.25)
  return g
}

// Add optional modelUrl strings here when custom enemy .glb files are ready
export const ENEMY_TYPES={
  rusher:{
    name:'Ashen Stalker',modelUrl:null,height:1.55,
    hp:25,speed:4.4,radius:.5,kbResist:1.0,
    attackRange:2.0,hitRadius:2.4,arc:Math.PI*.7,
    wind:.55,recovery:.85,damage:10,
    build:buildRusherMesh
  },
  shooter:{
    name:'Cinder Acolyte',modelUrl:null,height:1.85,
    hp:30,speed:2.7,radius:.55,kbResist:.9,
    preferredMin:8.5,preferredMax:14.5,
    wind:.85,recovery:1.35,damage:12,projSpeed:11.5,
    build:buildShooterMesh
  },
  brute:{
    name:'Magma Guard',modelUrl:null,height:2.2,
    hp:55,speed:2.4,radius:.75,kbResist:.45,
    attackRange:2.6,hitRadius:3.1,arc:Math.PI*.85,
    wind:.85,recovery:1.25,damage:16,
    build:buildBruteMesh
  }
}

export class Enemy{
  constructor(root,typeKey,pos,wardenModel=null,variant=0){
    const spec=ENEMY_TYPES[typeKey]??ENEMY_TYPES.rusher
    this.spec=spec
    this.type=typeKey
    this.hp=spec.hp
    this.maxHp=spec.hp
    this.radius=spec.radius
    this.phase='chase'
    this.time=0
    this.flash=0
    this.deathTime=0
    this.vel=new T.Vector3()

    this.mesh=new T.Group()
    this.mesh.position.set(pos.x,0,pos.z)
    root.add(this.mesh)
    if(wardenModel){
      const weapon=spec.build(this.mesh).userData.weapon
      if(typeKey==='shooter')replaceWeaponModel(weapon,wardenModel==='hell'?'hellStaff':'earthStaff')
      else replaceWeaponModel(weapon,wardenModel==='hell'?'warden':'earthSword',.85)
      this.mesh.userData.weapon=weapon
      this.animate=animateWarden(wardenModel,this.mesh,spec.height,typeKey,variant)
      this.castTip=weapon.getObjectByName('spell-origin')
      if(this.castTip){
        this.magicSchool=wardenModel
        this.castGlow=new T.Mesh(spellGlowGeometry,spellGlowMaterials[wardenModel])
        this.castGlow.visible=false
        this.castTip.add(this.castGlow)
      }
    }else attachModel(this.mesh,spec.modelUrl,spec.height,spec.build)
    this.weaponScale=this.animate?this.weapon.scale.x:1

    if(spec.hitRadius){
      const geo=new T.CircleGeometry(spec.hitRadius,32,Math.PI/2-spec.arc/2,spec.arc)
      geo.rotateX(-Math.PI/2)
      this.marker=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xff7b36,transparent:true,opacity:.4,depthWrite:false}))
      this.marker.visible=false
      root.add(this.marker)
    }
  }
  get position(){return this.mesh.position}
  get alive(){return this.hp>0}
  get weapon(){return this.mesh.userData.weapon??this.mesh.children[0]?.userData?.weapon}
  takeDamage(dmg,dir,kb){
    if(!this.alive)return
    this.hp=Math.max(0,this.hp-dmg)
    this.flash=.18
    this.vel.copy(dir).multiplyScalar(kb*this.spec.kbResist)
    if(this.marker)this.marker.visible=false
    const w=this.weapon
    if(w){w.rotation.x=0;w.scale.setScalar(this.weaponScale)}
    if(this.castGlow)this.castGlow.visible=false
    if(this.hp===0){
      this.deathTime=.4
      this.vel.multiplyScalar(.45)
      return
    }
    if(this.phase==='wind'){
      this.phase='recover'
      this.time=.45
    }
  }
  update(dt,player,combat){
    const pos=this.mesh.position
    this.vel.x=T.MathUtils.damp(this.vel.x,0,12,dt)
    this.vel.z=T.MathUtils.damp(this.vel.z,0,12,dt)
    pos.addScaledVector(this.vel,dt)

    if(!this.alive){
      if(this.marker)this.marker.visible=false
      this.deathTime=Math.max(0,this.deathTime-dt)
      const t=1-this.deathTime/.4
      const ease=t*t
      this.mesh.rotation.x=Math.min(1.35,ease*1.5)
      this.mesh.position.y=-ease*.35
      this.mesh.scale.setScalar(Math.max(.02,1-ease*.9))
      return
    }

    this.flash=Math.max(0,this.flash-dt)
    this.mesh.rotation.z=this.flash*1.1

    diff.subVectors(player.position,pos)
    const distance=diff.length()
    const w=this.weapon
    const {x,z}=pos

    if(this.type==='shooter'){
      this.updateShooter(dt,player,combat,diff,distance,w)
    }else{
      this.updateMelee(dt,player,combat,diff,distance,w)
    }
    if(this.animate&&!this.castTip){
      if(this.phase==='wind')this.animate(dt,'attack_1',.24*(1-this.time/this.spec.wind),true)
      else if(this.phase==='impact')this.animate(dt,'attack_1',.24+.76*(1-this.time/.18),true)
      else if(this.type==='shooter' && this.phase==='recover' && this.time>this.spec.recovery-.24){
        this.animate(dt,'special_thrust',.24+.76*(this.spec.recovery-this.time)/.24,true)
      }else this.animate(dt,pos.x!==x||pos.z!==z?'walk':'idle',0,true)
    }
  }
  updateMelee(dt,player,combat,diff,distance,w){
    const s=this.spec,pos=this.mesh.position
    if(this.phase==='chase'){
      face(this.mesh,diff)
      if(distance>s.attackRange){
        pos.addScaledVector(diff.normalize(),dt*s.speed)
      }else{
        this.phase='wind';this.time=s.wind
        if(this.marker){
          this.marker.position.set(pos.x,.025,pos.z)
          this.marker.rotation.y=this.mesh.rotation.y
          this.marker.visible=true;this.marker.scale.setScalar(1)
        }
      }
      return
    }
    this.time-=dt
    if(this.phase==='wind'){
      if(w&&!this.animate)w.rotation.x=.8
      if(this.marker){
        this.marker.position.set(pos.x,.025,pos.z)
        this.marker.material.opacity=.28+.18*Math.sin(this.time*18)
      }
      if(this.time<=0){
        this.phase='impact';this.time=.18
        if(w&&!this.animate)w.rotation.x=-1.4
        if(!combat.immune && distance<s.hitRadius && diff.normalize().dot(facing(this.mesh))>Math.cos(s.arc/2)){
          combat.damagePlayer(s.damage)
        }
      }
    }else if(this.phase==='impact'){
      if(this.marker)this.marker.scale.setScalar(1+(.18-this.time)*.5)
      if(this.time<=0){
        if(this.marker)this.marker.visible=false
        this.phase='recover';this.time=s.recovery
      }
    }else if(this.time<=0){
      this.phase='chase'
      if(w)w.rotation.x=0
    }
  }
  updateShooter(dt,player,combat,diff,distance,w){
    const s=this.spec,pos=this.mesh.position
    const {x,z}=pos
    face(this.mesh,diff)
    if(this.phase==='chase'){
      if(distance>s.preferredMax){
        pos.addScaledVector(diff.normalize(),dt*s.speed)
      }else if(distance<s.preferredMin){
        pos.addScaledVector(diff.normalize(),-dt*s.speed*.85)
      }else{
        this.phase='wind';this.time=s.wind
      }
      if(this.castTip)this.animate?.(dt,pos.x!==x||pos.z!==z?'walk':'idle',0,true)
      return
    }
    this.time-=dt
    if(this.phase==='wind'){
      const charge=T.MathUtils.clamp(1-this.time/s.wind,0,1)
      if(this.castTip){
        this.animate?.(dt,'cast',.57*charge,true)
        this.castGlow.visible=true
        this.castGlow.scale.setScalar(.25+charge*.85)
      }else if(w)w.scale.setScalar(this.weaponScale*(1+.35*Math.sin(charge*Math.PI)))
      if(this.time<=0){
        if(this.castTip){
          this.castGlow.visible=false
          this.mesh.parent.worldToLocal(this.castTip.getWorldPosition(spellOrigin))
          spellDirection.subVectors(player.position,spellOrigin).setY(0).normalize()
          combat.spawnProjectile(spellOrigin.x,spellOrigin.y,spellOrigin.z,spellDirection,s.projSpeed,s.damage,this.magicSchool)
        }else{
          if(w)w.scale.setScalar(this.weaponScale)
          const shotDir=diff.clone().normalize()
          combat.spawnProjectile(pos.x+shotDir.x*.8,1.1,pos.z+shotDir.z*.8,shotDir,s.projSpeed,s.damage)
        }
        this.phase='recover';this.time=s.recovery
      }
    }else{
      if(this.castTip){
        const follow=T.MathUtils.clamp((s.recovery-this.time)/.46,0,1)
        this.animate?.(dt,follow<1?'cast':'idle',.57+.43*follow,true)
      }
      if(this.time<=0)this.phase='chase'
    }
  }
  dispose(){
    if(this.animate)this.mesh.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose()})
    this.mesh.removeFromParent()
    if(this.marker){
      this.marker.removeFromParent()
      this.marker.geometry.dispose()
      this.marker.material.dispose()
    }
  }
}
