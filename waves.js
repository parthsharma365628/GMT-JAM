import * as T from 'three'
import {Enemy} from './enemies.js'

const DEFAULT_WAVES=[
  {enemies:['rusher','rusher','shooter']},
  {enemies:['rusher','rusher','shooter','brute']},
  {boss:true,enemies:['rusher','rusher']}
]

const PILLARS=[{x:-17,z:-17},{x:-17,z:17},{x:17,z:-17},{x:17,z:17}]

function pickSpawnPoint(playerPos,taken){
  for(let attempt=0;attempt<40;attempt++){
    const x=(Math.random()*2-1)*24
    const z=(Math.random()*2-1)*24
    if(Math.hypot(x-playerPos.x,z-playerPos.z)<7.5)continue
    if(PILLARS.some(p=>Math.hypot(x-p.x,z-p.z)<2.8))continue
    if(taken.some(p=>Math.hypot(x-p.x,z-p.z)<2.2))continue
    return {x,z}
  }
  return {x:0,z:-18}
}

export class WaveSpawner{
  constructor(root,cfg,player,boss){
    this.root=root
    this.waves=cfg.waves??DEFAULT_WAVES
    this.player=player
    this.boss=boss
    this.index=-1
    this.delay=0
    this.spawning=[]
    this.bossActive=false
    this.cleared=false
    this.boss.visible=false
  }
  get current(){return this.index+1}
  get total(){return this.waves.length}
  startNextWave(enemies){
    this.index++
    if(this.index>=this.waves.length){
      this.cleared=true
      return
    }
    const wave=this.waves[this.index]
    const taken=[]
    if(wave.boss){
      const bp=pickSpawnPoint(this.player.position,taken)
      taken.push(bp)
      this.boss.position.set(bp.x,0,bp.z)
      this.boss.rotation.set(0,0,0)
      this.boss.visible=this.boss.userData.weapon.visible=true
      this.bossActive=true
    }
    for(const type of wave.enemies??[]){
      const pt=pickSpawnPoint(this.player.position,taken)
      taken.push(pt)
      const geo=new T.RingGeometry(.35,.75,24)
      geo.rotateX(-Math.PI/2)
      const ring=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xff9a40,transparent:true,opacity:.8,side:T.DoubleSide}))
      ring.position.set(pt.x,.03,pt.z)
      this.root.add(ring)
      this.spawning.push({type,pos:pt,timer:.65,ring})
    }
  }
  update(dt,enemies,bossAlive){
    if(this.cleared)return
    for(let i=this.spawning.length-1;i>=0;i--){
      const s=this.spawning[i]
      s.timer-=dt
      s.ring.scale.setScalar(1+(.65-s.timer)*1.2)
      s.ring.material.opacity=Math.max(0,s.timer/.65)
      if(s.timer<=0){
        s.ring.removeFromParent();s.ring.geometry.dispose();s.ring.material.dispose()
        enemies.push(new Enemy(this.root,s.type,s.pos))
        this.spawning.splice(i,1)
      }
    }
    const anyAlive=enemies.some(e=>e.alive) || (this.bossActive && bossAlive)
    if(this.index===-1){
      this.startNextWave(enemies)
    }else if(!anyAlive && this.spawning.length===0){
      if(this.index+1>=this.waves.length){
        this.cleared=true
      }else{
        this.delay+=dt
        if(this.delay>=1.1){
          this.delay=0
          this.startNextWave(enemies)
        }
      }
    }
  }
  dispose(){
    for(const s of this.spawning){
      s.ring.removeFromParent();s.ring.geometry.dispose();s.ring.material.dispose()
    }
    this.spawning.length=0
  }
}