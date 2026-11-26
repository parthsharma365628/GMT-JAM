import * as T from 'three'
import {axis,pressed} from './input.js'
import {WaveSpawner} from './waves.js'
import {sword} from './world.js'

const attacks={
  swing:{radius:3.6,arc:Math.PI*.75,wind:.95,recovery:1.55},
  slam:{radius:4.8,arc:Math.PI*2,wind:1.55,recovery:2.1}
}

export const DEFAULT_COMBO=[
  {anim:'attack_1',dur:.42,dmg:10,range:3.0,arc:.15,winStart:.12,winEnd:.30,step:4.5,kb:3.0,stop:.045,shake:.18},
  {anim:'attack_2',dur:.42,dmg:12,range:3.1,arc:.15,winStart:.12,winEnd:.30,step:5.0,kb:3.5,stop:.045,shake:.20},
  {anim:'attack_3',dur:.58,dmg:20,range:3.5,arc:-.2,winStart:.18,winEnd:.40,step:7.5,kb:14.0,stop:.08,shake:.42}
]
export const DEFAULT_DASH_STRIKE={anim:'dash_strike',dur:.36,dmg:15,range:3.8,arc:.15,winStart:.05,winEnd:.28,step:9.0,kb:7.5,stop:.06,shake:.28}
export const DEFAULT_SPECIAL={
  anim:'special_spin',dur:.56,dmg:22,range:3.5,arc:-1.1,winStart:.12,winEnd:.44,step:3.5,kb:11.0,stop:.07,shake:.34,
  cd:2.0,deflect:true,proj:{speed:18,dmg:14,life:.65,color:0xffd470}
}

const MOVE_SPEED=5.5, DASH_SPEED=13.5, DASH_TIME=.28, COMBO_WINDOW=.65, SWITCH_LOCKOUT=2.5, ARENA_LIMIT=28.5
const PILLARS=[{x:-17,z:-17,r:.85},{x:-17,z:17,r:.85},{x:17,z:-17,r:.85},{x:17,z:17,r:.85}]
const projGeo=new T.SphereGeometry(.24,10,10)
const projMat=new T.MeshBasicMaterial({color:0xff6b3d})
const earthProjMat=new T.MeshBasicMaterial({color:0xa4f180})
const heavenProjMat=new T.MeshBasicMaterial({color:0x8bdfff})
const reflectedMat=new T.MeshBasicMaterial({color:0x6ef3ff})
const waveGeo=new T.RingGeometry(1.15,1.65,24,1,Math.PI*.22,Math.PI*.56)
waveGeo.rotateX(-Math.PI/2)

const forward=new T.Vector3(), delta=new T.Vector3(), sep=new T.Vector3()

export function equipWeaponMesh(actor,weapon){
  const mount=actor.userData.weapon
  if(!mount)return
  mount.clear()
  if(weapon?.createMesh)weapon.createMesh(mount)
  else sword(mount,0,0,0)
}

function targetAngle(dir){return Math.atan2(-dir.x,-dir.z)}
function face(model,dir){model.rotation.y=targetAngle(dir)}
function turnToward(model,dir,rate,dt){
  const target=targetAngle(dir)
  let diff=((target-model.rotation.y+Math.PI)%(Math.PI*2))-Math.PI
  if(diff<-Math.PI)diff+=Math.PI*2
  model.rotation.y+=diff*(1-Math.exp(-rate*dt))
}
function facing(model){return forward.set(-Math.sin(model.rotation.y),0,-Math.cos(model.rotation.y))}

function resolveArena(pos,radius){
  for(const p of PILLARS){
    const dx=pos.x-p.x, dz=pos.z-p.z
    const dist=Math.hypot(dx,dz), minDist=p.r+radius
    if(dist<minDist){
      const nx=dist>.001?dx/dist:1, nz=dist>.001?dz/dist:0
      pos.x=p.x+nx*minDist
      pos.z=p.z+nz*minDist
    }
  }
  pos.x=T.MathUtils.clamp(pos.x,-ARENA_LIMIT,ARENA_LIMIT)
  pos.z=T.MathUtils.clamp(pos.z,-ARENA_LIMIT-.1,ARENA_LIMIT)
}

const hitBox=new T.Box3(),hitCenter=new T.Vector3()
export class Combat{
  // Record a hit for the damage popup: world position above the target's head, damage, and whether it was a heavy hit.
  reportHit(target,dmg,heavy){
    hitBox.setFromObject(target).getCenter(hitCenter)
    this.hits.push({x:hitCenter.x,y:hitBox.max.y,z:hitCenter.z,dmg:Math.round(dmg),heavy})
  }
  constructor(root,player,boss,cfg,maxHp=100,weapon=null){
    Object.assign(this,{
      root,player,boss,cfg,hp:maxHp,maxHp,bossHp:cfg.hp,phase:'chase',time:0,cycle:0,
      cooldown:0,dash:0,attack:0,immune:0,flash:0,hitstop:0,shake:0,
      switchLockout:0,potionCooldown:0,specialCooldown:0,specialMaxCd:DEFAULT_SPECIAL.cd,
      comboStep:0,comboTimer:0,comboBuffered:false,projFired:false
    })
    this.hits=[] // damage dealt this frame, read by main.js to show damage popups
    this.combo=DEFAULT_COMBO
    this.dashStrike=DEFAULT_DASH_STRIKE
    this.special=DEFAULT_SPECIAL
    this.activeMove=this.combo[0]
    this.dir=new T.Vector3(0,0,-1)
    this.dashDir=this.dir.clone()
    this.vel=new T.Vector3()
    this.bossVel=new T.Vector3()
    this.bossFallTime=0
    this.anim={state:'idle',action:'idle',trigger:null,speed:0,progress:0}
    this.enemies=[]
    this.projectiles=[]
    this.playerWaves=[]
    this.hitTargets=new Set()
    this.waves=new WaveSpawner(root,cfg,player,boss)
    this.markers={}
    for(const [key,a] of Object.entries(attacks)){
      const geo=new T.CircleGeometry(a.radius,48,Math.PI/2-a.arc/2,a.arc)
      geo.rotateX(-Math.PI/2)
      const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xff9a40,transparent:true,opacity:.45,depthWrite:false}))
      root.add(m);m.visible=false;this.markers[key]=m
    }
    if(weapon)this.setWeapon(weapon,false)
  }
  get cleared(){return this.waves.cleared}
  updateBossFall(dt){
    if(!this.waves.bossActive||this.bossHp>0||this.bossFallTime>=1)return
    const boss=this.boss
    if(this.bossFallTime===0)this.bossFallStart=boss.rotation.z
    this.bossFallTime=Math.min(1,this.bossFallTime+dt)
    const fall=T.MathUtils.smoothstep(this.bossFallTime,0,1)
    boss.rotation.z=T.MathUtils.lerp(this.bossFallStart,1.5,fall)
    boss.userData.animate?.(dt,'defeat',.5*fall,true)
  }
  get canSwitch(){return this.attack<=0 && this.dash<=0 && this.switchLockout<=0}
  get specialReady(){return this.specialCooldown<=0}
  setWeapon(weapon,triggerLockout=false){
    this.weapon=weapon
    this.combo=weapon?.combo?.length?weapon.combo:DEFAULT_COMBO
    this.dashStrike=weapon?.dashStrike??DEFAULT_DASH_STRIKE
    this.special=weapon?.special??DEFAULT_SPECIAL
    this.specialMaxCd=this.special.cd??2.0
    this.comboStep=0
    this.comboTimer=0
    this.comboBuffered=false
    this.attack=this.dash=0
    Object.assign(this.anim,{state:'idle',action:'idle',trigger:null,speed:0,progress:0})
    this.activeMove=this.combo[0]
    if(triggerLockout)this.switchLockout=.45
    equipWeaponMesh(this.player,weapon)
  }
  heal(amount){
    this.hp=Math.min(this.maxHp,this.hp+amount)
    this.potionCooldown=1.5
  }
  damagePlayer(amount){
    if(this.immune>0)return
    this.hp=Math.max(0,this.hp-amount)
    this.immune=.75
    this.shake=Math.max(this.shake,.25)
  }
  spawnProjectile(x,y,z,dir,speed,damage,school){
    const mesh=new T.Mesh(projGeo,school==='heaven'?heavenProjMat:school==='earth'?earthProjMat:projMat)
    mesh.position.set(x,y,z)
    this.root.add(mesh)
    this.projectiles.push({mesh,vx:dir.x*speed,vz:dir.z*speed,damage,life:3.2,reflected:false})
  }
  spawnSlashWave(spec){
    const p=this.player
    const mat=new T.MeshBasicMaterial({color:spec.color??0xffd470,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false})
    const mesh=new T.Mesh(waveGeo,mat)
    mesh.position.set(p.position.x+this.dir.x*.9,1.0,p.position.z+this.dir.z*.9)
    face(mesh,this.dir)
    this.root.add(mesh)
    this.playerWaves.push({
      mesh,mat,vx:this.dir.x*spec.speed,vz:this.dir.z*spec.speed,
      dmg:spec.dmg,life:spec.life,maxLife:spec.life,hit:new Set()
    })
  }
  findNearestTarget(maxDist){
    let best=null, bestD=maxDist
    if(this.waves.bossActive && this.bossHp>0){
      const d=this.player.position.distanceTo(this.boss.position)
      if(d<bestD){bestD=d;best=this.boss.position}
    }
    for(const e of this.enemies){
      if(!e.alive)continue
      const d=this.player.position.distanceTo(e.position)
      if(d<bestD){bestD=d;best=e.position}
    }
    return best
  }
  startAttack(move){
    const p=this.player
    this.activeMove=move
    this.attack=move.dur
    this.switchLockout=SWITCH_LOCKOUT
    this.hitTargets.clear()
    this.comboBuffered=false
    this.projFired=false
    if(move===this.special){
      this.specialCooldown=this.specialMaxCd
      this.comboStep=0
      this.comboTimer=0
    }
    this.anim.trigger=move.anim
    this.anim.action=move.anim
    this.anim.state='attack'
    this.anim.progress=0
    const autoAimRange=move===this.special?5.2:move===this.dashStrike?4.2:3.5
    const target=this.findNearestTarget(autoAimRange)
    if(target){
      this.dir.subVectors(target,p.position).setY(0).normalize()
    }
    this.vel.copy(this.dir).multiplyScalar(move.step)
  }
  move(dt,active){
    const p=this.player,b=this.boss
    const x=axis('right','left'),z=axis('down','up')
    const dir=delta.set(x+z,0,z-x).normalize()

    this.anim.trigger=null
    this.cooldown=Math.max(0,this.cooldown-dt)
    this.immune=Math.max(0,this.immune-dt)
    this.switchLockout=Math.max(0,this.switchLockout-dt)
    this.potionCooldown=Math.max(0,this.potionCooldown-dt)
    this.specialCooldown=Math.max(0,this.specialCooldown-dt)
    if(this.attack<=0 && this.comboTimer>0){
      this.comboTimer=Math.max(0,this.comboTimer-dt)
      if(this.comboTimer===0)this.comboStep=0
    }

    const wantsDodge=pressed.has('dodge') || pressed.has('jump')
    const wantsAttack=pressed.has('attack')
    const wantsSpecial=pressed.has('special')

    if(active && wantsDodge && !this.cooldown && this.dash<=0){
      this.attack=0;this.comboStep=0;this.comboBuffered=false
      this.dash=DASH_TIME;this.cooldown=1;this.immune=.34;this.switchLockout=SWITCH_LOCKOUT
      this.dashDir.copy(dir.lengthSq()?dir:this.dir)
      this.dir.copy(this.dashDir);face(p,this.dir)
      this.vel.copy(this.dashDir).multiplyScalar(DASH_SPEED)
      this.anim.trigger='dash'
      this.anim.action='dash'
    }

    if(active && wantsAttack && this.dash>0){
      this.dash=0;this.comboStep=0
      this.startAttack(this.dashStrike)
    }else if(active && wantsSpecial && this.specialReady && (this.dash>0 || this.attack<=0)){
      this.dash=0;this.comboStep=0
      this.startAttack(this.special)
    }

    if(this.dash>0){
      this.dash=Math.max(0,this.dash-dt)
      p.position.addScaledVector(this.dashDir,dt*DASH_SPEED)
      this.anim.state='dash'
      this.anim.action='dash'
      this.anim.speed=1
      this.anim.progress=1-this.dash/DASH_TIME
    }else if(this.attack>0){
      turnToward(p,this.dir,24,dt)
      if(active && wantsAttack && this.activeMove!==this.dashStrike && this.activeMove!==this.special){
        this.comboBuffered=true
      }
      this.vel.x=T.MathUtils.damp(this.vel.x,0,10,dt)
      this.vel.z=T.MathUtils.damp(this.vel.z,0,10,dt)
      p.position.addScaledVector(this.vel,dt)

      this.attack=Math.max(0,this.attack-dt)
      this.anim.state='attack'
      this.anim.action=this.activeMove.anim
      this.anim.speed=0
      this.anim.progress=1-this.attack/this.activeMove.dur

      if(this.attack===0){
        if(this.activeMove!==this.dashStrike && this.activeMove!==this.special){
          this.comboStep=(this.comboStep+1)%this.combo.length
          this.comboTimer=COMBO_WINDOW
          if(this.comboBuffered){
            this.startAttack(this.combo[this.comboStep])
          }
        }else{
          this.comboStep=0
        }
      }
    }else{
      const targetVx=dir.x*MOVE_SPEED, targetVz=dir.z*MOVE_SPEED
      this.vel.x=T.MathUtils.damp(this.vel.x,targetVx,16,dt)
      this.vel.z=T.MathUtils.damp(this.vel.z,targetVz,16,dt)
      p.position.addScaledVector(this.vel,dt)

      if(dir.lengthSq()){
        this.dir.copy(dir)
        turnToward(p,dir,14,dt)
      }
      if(active && wantsSpecial && this.specialReady){
        this.startAttack(this.special)
      }else if(active && wantsAttack){
        this.startAttack(this.combo[this.comboStep])
      }else{
        const speedNorm=Math.min(1,Math.hypot(this.vel.x,this.vel.z)/MOVE_SPEED)
        this.anim.state=speedNorm>.08?'run':'idle'
        this.anim.action=this.anim.state
        this.anim.speed=speedNorm
        this.anim.progress=0
      }
    }

    resolveArena(p.position,.45)
    p.visible=!this.immune || Math.floor(this.immune*20)%2===0

    const w=p.userData.weapon
    if(this.anim.state==='attack'){
      const prog=this.anim.progress
      if(!p.userData.rigged && w){
        p.rotation.x=Math.sin(prog*Math.PI)*.18
        if(this.activeMove===this.special){
          w.rotation.x=-Math.sin(prog*Math.PI)*2.6
          w.rotation.y=prog*Math.PI*2
        }else if(this.activeMove.anim==='attack_2'){
          w.rotation.x=-Math.sin(prog*Math.PI)*1.6
          w.rotation.z=Math.sin(prog*Math.PI)*.7
        }else if(this.activeMove.anim==='attack_3'){
          w.rotation.x=-Math.sin(prog*Math.PI)*2.4
          w.rotation.z=-Math.sin(prog*Math.PI)*.5
        }else if(this.activeMove.anim==='dash_strike'){
          w.rotation.x=-Math.sin(prog*Math.PI)*2.2
          w.rotation.z=0
        }else{
          w.rotation.x=-Math.sin(prog*Math.PI)*1.8
          w.rotation.z=0
        }
      }
      const m=this.activeMove
      if(this.attack<m.winEnd && this.attack>m.winStart){
        if(m.proj && !this.projFired){
          this.projFired=true
          this.spawnSlashWave(m.proj)
        }
        let landedAny=false
        const heavyMove=m===this.special || m===this.combo[this.combo.length-1] // finisher or special
        if(this.waves.bossActive && this.bossHp>0 && !this.hitTargets.has(b)){
          diffCheck(b.position,p.position,this.dir,m.range+.6,m.arc,()=>{
            this.bossHp=Math.max(0,this.bossHp-m.dmg)
            this.reportHit(b,m.dmg,heavyMove)
            this.hitTargets.add(b)
            this.flash=.18
            this.bossVel.copy(this.dir).multiplyScalar(m.kb)
            landedAny=true
          })
        }
        for(const e of this.enemies){
          if(!e.alive || this.hitTargets.has(e))continue
          diffCheck(e.position,p.position,this.dir,m.range+e.radius,m.arc,()=>{
            e.takeDamage(m.dmg,this.dir,m.kb)
            this.reportHit(e.mesh,m.dmg,heavyMove)
            this.hitTargets.add(e)
            landedAny=true
          })
        }
        // Deflect or shatter incoming enemy fireballs during swing window
        for(let i=this.projectiles.length-1;i>=0;i--){
          const pr=this.projectiles[i]
          if(pr.reflected)continue
          const d=Math.hypot(pr.mesh.position.x-p.position.x,pr.mesh.position.z-p.position.z)
          if(d<m.range+.4){
            if(m.deflect){
              pr.reflected=true
              pr.mesh.material=reflectedMat
              pr.mesh.scale.setScalar(1.35)
              const spd=Math.hypot(pr.vx,pr.vz)*1.35
              pr.vx=this.dir.x*spd
              pr.vz=this.dir.z*spd
              pr.damage=25
              pr.life=2.2
            }else{
              pr.mesh.removeFromParent()
              this.projectiles.splice(i,1)
            }
            landedAny=true
          }
        }
        if(landedAny){
          this.hitstop=Math.max(this.hitstop,m.stop)
          this.shake=Math.max(this.shake,m.shake)
          if(m!==this.special){
            this.specialCooldown=Math.max(0,this.specialCooldown-.35)
          }
        }
      }
    }else if(!p.userData.rigged && w){
      p.rotation.x=0
      w.rotation.set(0,0,0)
    }
  }
  update(dt){
    if(this.hitstop>0){
      this.hitstop=Math.max(0,this.hitstop-dt)
      dt*=.05
    }
    this.move(dt,true)
    const b=this.boss,p=this.player

    this.waves.update(dt,this.enemies,this.bossHp>0)

    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i]
      e.update(dt,p,this)
      if(!e.alive){
        if(e.deathTime<=0){
          e.dispose()
          this.enemies.splice(i,1)
        }
        continue
      }
      resolveArena(e.position,e.radius)
    }
    for(let i=0;i<this.enemies.length;i++){
      const a=this.enemies[i]; if(!a.alive)continue
      for(let j=i+1;j<this.enemies.length;j++){
        const c=this.enemies[j]; if(!c.alive)continue
        sep.subVectors(a.position,c.position).setY(0)
        const d=sep.length(), minD=a.radius+c.radius
        if(d<minD){
          if(d>.001)sep.divideScalar(d);else sep.set(1,0,0)
          const push=(minD-d)*.5
          a.position.addScaledVector(sep,push)
          c.position.addScaledVector(sep,-push)
        }
      }
    }

    // Update player Special slash waves
    for(let i=this.playerWaves.length-1;i>=0;i--){
      const wv=this.playerWaves[i]
      wv.life-=dt
      wv.mesh.position.x+=wv.vx*dt
      wv.mesh.position.z+=wv.vz*dt
      const t=1-wv.life/wv.maxLife
      wv.mesh.scale.setScalar(1+t*.55)
      wv.mat.opacity=Math.max(0,(wv.life/wv.maxLife)*.9)

      const hitWall=Math.abs(wv.mesh.position.x)>ARENA_LIMIT || Math.abs(wv.mesh.position.z)>ARENA_LIMIT
      const hitPillar=PILLARS.some(pl=>Math.hypot(wv.mesh.position.x-pl.x,wv.mesh.position.z-pl.z)<pl.r+.4)
      if(this.waves.bossActive && this.bossHp>0 && !wv.hit.has(b)){
        if(Math.hypot(wv.mesh.position.x-b.position.x,wv.mesh.position.z-b.position.z)<1.6){
          this.bossHp=Math.max(0,this.bossHp-wv.dmg)
          this.reportHit(b,wv.dmg,true)
          wv.hit.add(b)
          this.flash=.15
        }
      }
      for(const e of this.enemies){
        if(!e.alive || wv.hit.has(e))continue
        if(Math.hypot(wv.mesh.position.x-e.position.x,wv.mesh.position.z-e.position.z)<e.radius+1.15){
          e.takeDamage(wv.dmg,this.dir,5.0)
          this.reportHit(e.mesh,wv.dmg,true)
          wv.hit.add(e)
        }
      }
      if(wv.life<=0 || hitWall || hitPillar){
        wv.mesh.removeFromParent()
        wv.mat.dispose()
        this.playerWaves.splice(i,1)
      }
    }

    // Update enemy projectiles (and reflected projectiles!)
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i]
      pr.life-=dt
      pr.mesh.position.x+=pr.vx*dt
      pr.mesh.position.z+=pr.vz*dt
      const hitWall=Math.abs(pr.mesh.position.x)>ARENA_LIMIT || Math.abs(pr.mesh.position.z)>ARENA_LIMIT
      const hitPillar=PILLARS.some(pl=>Math.hypot(pr.mesh.position.x-pl.x,pr.mesh.position.z-pl.z)<pl.r+.22)
      let hitUnit=false
      if(pr.reflected){
        if(this.waves.bossActive && this.bossHp>0 && Math.hypot(pr.mesh.position.x-b.position.x,pr.mesh.position.z-b.position.z)<1.2){
          this.bossHp=Math.max(0,this.bossHp-pr.damage)
          this.reportHit(b,pr.damage,true)
          this.flash=.18
          hitUnit=true
        }
        for(const e of this.enemies){
          if(!e.alive)continue
          if(Math.hypot(pr.mesh.position.x-e.position.x,pr.mesh.position.z-e.position.z)<e.radius+.35){
            e.takeDamage(pr.damage,this.dir,9.0)
            this.reportHit(e.mesh,pr.damage,true)
            hitUnit=true
            break
          }
        }
      }else{
        hitUnit=Math.hypot(pr.mesh.position.x-p.position.x,pr.mesh.position.z-p.position.z)<.68
        if(hitUnit)this.damagePlayer(pr.damage)
      }
      if(pr.life<=0 || hitWall || hitPillar || hitUnit){
        pr.mesh.removeFromParent()
        this.projectiles.splice(i,1)
      }
    }

    if(!this.waves.bossActive || !this.bossHp){
      Object.values(this.markers).forEach(m=>m.visible=false)
      return
    }

    this.bossVel.x=T.MathUtils.damp(this.bossVel.x,0,12,dt)
    this.bossVel.z=T.MathUtils.damp(this.bossVel.z,0,12,dt)
    b.position.addScaledVector(this.bossVel,dt)
    resolveArena(b.position,.85)

    this.flash=Math.max(0,this.flash-dt);b.rotation.z=this.flash*.9
    const animateBoss=b.userData.animate
    const diff=delta.subVectors(p.position,b.position),distance=diff.length()
    if(this.phase==='chase'){
      face(b,diff)
      animateBoss?.(dt,distance>2.9?'warden_walk':'idle',0,true)
      if(distance>2.9)b.position.addScaledVector(diff.normalize(),dt*this.cfg.chaseSpeed)
      else{
        this.key=this.cfg.attacks[this.cycle++%this.cfg.attacks.length]
        this.phase='wind';this.time=attacks[this.key].wind
        const m=this.markers[this.key];m.position.copy(b.position);m.position.y=.025
        m.rotation.y=b.rotation.y;m.visible=true;m.scale.setScalar(1)
      }
      return
    }
    this.time-=dt
    const a=attacks[this.key],m=this.markers[this.key]
    if(this.phase==='wind'){
      m.position.copy(b.position);m.position.y=.025
      if(!animateBoss)b.userData.weapon.rotation.x=.85
      m.material.opacity=.32+.18*Math.sin(this.time*17)
      if(this.time<=0){
        this.phase='impact';this.time=.24
        if(!animateBoss)b.userData.weapon.rotation.x=-1.5
        if(!this.immune && distance<a.radius && (a.arc>=6 || diff.normalize().dot(facing(b))>Math.cos(a.arc/2))){
          this.damagePlayer(this.cfg.damage)
        }
      }
    }else if(this.phase==='impact'){
      m.scale.setScalar(1+(.24-this.time)*.6)
      if(this.time<=0){m.visible=false;this.phase='recover';this.time=a.recovery}
    }else if(this.time<=0){this.phase='chase';b.userData.weapon.rotation.x=0}
    if(animateBoss){
      const motion=this.key==='slam'?'warden_slam':'warden_swing'
      if(this.phase==='wind')animateBoss(dt,motion,.48*(1-this.time/a.wind),true)
      else if(this.phase==='impact')animateBoss(dt,motion,.48+.28*(1-this.time/.24),true)
      else if(this.phase==='recover')animateBoss(dt,motion,.76+.24*(1-this.time/a.recovery),true)
      else animateBoss(dt,'idle',0,true)
    }
  }
  dispose(){
    this.waves.dispose()
    for(const e of this.enemies)e.dispose()
    for(const pr of this.projectiles)pr.mesh.removeFromParent()
    for(const wv of this.playerWaves){wv.mesh.removeFromParent();wv.mat.dispose()}
    for(const m of Object.values(this.markers)){m.removeFromParent();m.geometry.dispose();m.material.dispose()}
  }
}

function diffCheck(targetPos,playerPos,dir,range,arc,onHit){
  delta.subVectors(targetPos,playerPos).setY(0)
  const d=delta.length()
  if(d<range && (d<.001 || delta.divideScalar(d).dot(dir)>arc))onHit()
}
