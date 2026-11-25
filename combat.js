import * as T from 'three'
import {axis,pressed} from './input.js'
const attacks={
  swing:{radius:3.6,arc:Math.PI*.75,wind:.95,recovery:1.55},
  slam:{radius:4.8,arc:Math.PI*2,wind:1.55,recovery:2.1}
}
const forward=new T.Vector3(), delta=new T.Vector3()
function face(model,dir){model.rotation.y=Math.atan2(-dir.x,-dir.z)}
function facing(model){return forward.set(-Math.sin(model.rotation.y),0,-Math.cos(model.rotation.y))}
export class Combat{
  constructor(root,player,boss,cfg){
    Object.assign(this,{player,boss,cfg,hp:100,bossHp:cfg.hp,phase:'chase',time:0,cycle:0,cooldown:0,dash:0,attack:0,immune:0,flash:0})
    this.dir=new T.Vector3(0,0,-1);this.dashDir=this.dir.clone()
    this.markers={}
    for(const [key,a] of Object.entries(attacks)){
      const geo=new T.CircleGeometry(a.radius,48,Math.PI/2-a.arc/2,a.arc)
      geo.rotateX(-Math.PI/2)
      const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xff9a40,transparent:true,opacity:.45,depthWrite:false}))
      root.add(m);m.visible=false;this.markers[key]=m
    }
  }
  move(dt,active){
    const p=this.player,b=this.boss
    const x=axis('right','left'),z=axis('down','up')
    const dir=delta.set(x+z,0,z-x).normalize()
    this.moving=false
    this.cooldown=Math.max(0,this.cooldown-dt)
    this.immune=Math.max(0,this.immune-dt)
    if(active && pressed.has('dodge') && !this.cooldown && !this.attack){
      this.dash=.28;this.cooldown=1;this.immune=.34;this.dashDir.copy(dir.lengthSq()?dir:this.dir)
    }
    if(this.dash>0){this.dash-=dt;p.position.addScaledVector(this.dashDir,dt*13)}
    else if(!this.attack){
      p.position.addScaledVector(dir,dt*5)
      this.moving=dir.lengthSq()>0
      if(dir.lengthSq()){this.dir.copy(dir);face(p,dir)}
      if(active && pressed.has('attack')){
        this.attack=.56;this.hit=false
        if(p.position.distanceTo(b.position)<3.5){this.dir.subVectors(b.position,p.position).normalize();face(p,this.dir)}
      }
    }
    p.position.x=T.MathUtils.clamp(p.position.x,-8.5,8.5);p.position.z=T.MathUtils.clamp(p.position.z,-8.6,8.5)
    p.visible=!this.immune || Math.floor(this.immune*20)%2===0
    if(this.attack){
      this.attack=Math.max(0,this.attack-dt)
      const diff=delta.subVectors(b.position,p.position)
      if(!this.hit && this.attack<.38 && this.attack>.17 && diff.length()<3 && diff.normalize().dot(this.dir)>.15){
        this.bossHp=Math.max(0,this.bossHp-10);this.hit=true;this.flash=.18
      }
    }
  }
  update(dt){
    this.move(dt,true)
    const b=this.boss,p=this.player
    this.flash=Math.max(0,this.flash-dt);b.rotation.z=this.flash*.9
    if(!this.bossHp){Object.values(this.markers).forEach(m=>m.visible=false);return}
    const diff=delta.subVectors(p.position,b.position),distance=diff.length()
    if(this.phase==='chase'){
      face(b,diff)
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
      b.userData.weapon.rotation.x=.85;m.material.opacity=.32+.18*Math.sin(this.time*17)
      if(this.time<=0){
        this.phase='impact';this.time=.24;b.userData.weapon.rotation.x=-1.5
        if(!this.immune && distance<a.radius && (a.arc>=6 || diff.normalize().dot(facing(b))>Math.cos(a.arc/2))){
          this.hp=Math.max(0,this.hp-this.cfg.damage);this.immune=.75
        }
      }
    }else if(this.phase==='impact'){
      m.scale.setScalar(1+(.24-this.time)*.6)
      if(this.time<=0){m.visible=false;this.phase='recover';this.time=a.recovery}
    }else if(this.time<=0){this.phase='chase';b.userData.weapon.rotation.x=0}
  }
  dispose(){for(const m of Object.values(this.markers)){m.removeFromParent();m.geometry.dispose();m.material.dispose()}}
}
