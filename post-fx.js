import * as T from 'three'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'

// ── Bloom settings for the whole game. Change these to taste (they are read every frame).
//   amount     strength of the glow (0 turns bloom off)
//   radius     how far the glow spreads (0..1)
//   threshold  how bright a pixel's brightest colour channel must be (linear light) before it glows;
//              lower = more of the scene glows. Lava, embers, trails and hazard rims sit above 1.
//   softness   how gradually glow fades in above the threshold
//   realm      per-realm overrides of any of the above (Heaven's white marble is bright, so it needs a higher threshold)
export const BLOOM={
  amount:.9,radius:.55,threshold:.8,softness:.3,
  realm:{hell:{},forest:{threshold:.9},heaven:{threshold:1.15,amount:.7}}
}

// Post-processing for every frame: scene -> (runner motion blur) -> bloom -> screen.
//
// Motion blur works by depth reprojection. The scene is rendered into a multisampled target with a depth texture;
// each pixel is turned back into a world position and projected with last frame's camera, which gives its
// screen-space motion, and colour is averaged along it. Running forward streaks the world outward, strafing and
// turns smear it sideways, and camera shake blurs too. The runner moves with the camera, so a second cheap pass
// draws only the player (layer 1) into a mask and masked pixels stay sharp.
const PLAYER_LAYER=1, SAMPLES=14, MAX_BLUR=.045

export function createPostFx(renderer){
  const size=new T.Vector2()
  const sceneTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4})
  sceneTarget.depthTexture=new T.DepthTexture(1,1)
  const blurTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false})
  const mask=new T.WebGLRenderTarget(1,1)
  const white=new T.MeshBasicMaterial({color:0xffffff})
  const bloom=new UnrealBloomPass(new T.Vector2(256,256),BLOOM.amount,BLOOM.radius,BLOOM.threshold)
  const output=new OutputPass();output.renderToScreen=true
  // three's bloom picks pixels by luminance, which almost ignores pure reds (lava at 1.1 red is ~0.3 luminance).
  // Use the brightest colour channel instead, so red and orange glows bloom like white ones.
  bloom.materialHighPassFilter.fragmentShader=`
    uniform sampler2D tDiffuse;uniform vec3 defaultColor;uniform float defaultOpacity;
    uniform float luminosityThreshold;uniform float smoothWidth;varying vec2 vUv;
    void main(){
      vec4 texel=texture2D(tDiffuse,vUv);
      float v=max(texel.r,max(texel.g,texel.b));
      float alpha=smoothstep(luminosityThreshold,luminosityThreshold+smoothWidth,v);
      gl_FragColor=mix(vec4(defaultColor,defaultOpacity),texel,alpha);
    }`
  bloom.materialHighPassFilter.needsUpdate=true
  let realm='hell'
  const uniforms={
    tColor:{value:sceneTarget.texture},tDepth:{value:sceneTarget.depthTexture},tMask:{value:mask.texture},
    invViewProj:{value:new T.Matrix4()},prevViewProj:{value:new T.Matrix4()},
    strength:{value:0},maxBlur:{value:MAX_BLUR}
  }
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
    uniforms,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`
      uniform sampler2D tColor;uniform sampler2D tDepth;uniform sampler2D tMask;
      uniform mat4 invViewProj;uniform mat4 prevViewProj;uniform float strength;uniform float maxBlur;
      varying vec2 vUv;
      // Drop NaN / infinite pixels and clamp extreme highlights. One bad pixel would otherwise be smeared over the
      // whole screen by bloom (the Heaven arena has some).
      // (checked on the bits: an all-ones exponent is NaN or infinity; isnan() can be optimised away)
      bool bad(float v){return (floatBitsToUint(v)&0x7f800000u)==0x7f800000u;}
      vec4 clean(vec4 c){
        if(bad(c.r)||bad(c.g)||bad(c.b))return vec4(0.0,0.0,0.0,1.0);
        return clamp(c,0.0,16.0);
      }
      void main(){
        float depth=texture2D(tDepth,vUv).x;
        vec4 world=invViewProj*vec4(vUv*2.0-1.0,depth*2.0-1.0,1.0);world/=world.w;
        vec4 prev=prevViewProj*world;vec2 prevUv=prev.xy/prev.w*.5+.5;
        vec2 vel=(vUv-prevUv)*strength;
        float len=length(vel);if(len>maxBlur)vel*=maxBlur/len;
        vel*=1.0-texture2D(tMask,vUv).r;
        vec4 sum=clean(texture2D(tColor,vUv));float total=1.0;
        for(int i=1;i<${SAMPLES};i++){
          float t=float(i)/float(${SAMPLES-1})-.5;
          vec2 uv=vUv+vel*t;
          float w=1.0-texture2D(tMask,uv).r*.9; // keep the runner's own colour out of the background smear
          sum+=clean(texture2D(tColor,uv))*w;total+=w;
        }
        gl_FragColor=sum/total;
      }`
  }))
  const cleanTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false})
  const cleanQuad=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
    uniforms:{tColor:{value:sceneTarget.texture}},depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D tColor;varying vec2 vUv;
      // Drop NaN / infinite pixels and clamp extreme highlights. One bad pixel would otherwise be smeared over the
      // whole screen by bloom (the Heaven arena has some).
      // (checked on the bits: an all-ones exponent is NaN or infinity; isnan() can be optimised away)
      bool bad(float v){return (floatBitsToUint(v)&0x7f800000u)==0x7f800000u;}
      vec4 clean(vec4 c){
        if(bad(c.r)||bad(c.g)||bad(c.b))return vec4(0.0,0.0,0.0,1.0);
        return clamp(c,0.0,16.0);
      }
      void main(){gl_FragColor=clean(texture2D(tColor,vUv));}`
  }))
  const cleanScene=new T.Scene();cleanQuad.frustumCulled=false;cleanScene.add(cleanQuad)
  const quadScene=new T.Scene(),quadCamera=new T.OrthographicCamera(-1,1,1,-1,0,1)
  quad.frustumCulled=false;quadScene.add(quad)
  const viewProj=new T.Matrix4(),prevCamPos=new T.Vector3()
  let level=0,hadPrev=false

  function resize(){
    renderer.getDrawingBufferSize(size)
    if(sceneTarget.width===size.x && sceneTarget.height===size.y)return
    sceneTarget.setSize(size.x,size.y);blurTarget.setSize(size.x,size.y);cleanTarget.setSize(size.x,size.y);mask.setSize(size.x>>1,size.y>>1)
    bloom.setSize(size.x,size.y)
  }
  const tagPlayer=player=>player.traverse(o=>o.layers.enable(PLAYER_LAYER))

  return {
    setRealm(name){realm=name},
    // blurAmount 0..1 sets the motion blur strength (0 skips the blur passes).
    render(scene,camera,player,dt,blurAmount){
      resize()
      level=T.MathUtils.damp(level,blurAmount,6,dt)
      camera.updateMatrixWorld()
      viewProj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
      const cut=prevCamPos.distanceToSquared(camera.position)>9 // respawn or scene change: no blur this frame
      prevCamPos.copy(camera.position)

      renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera)
      let source=sceneTarget
      if(level>.02 && hadPrev && !cut && dt>0){
        tagPlayer(player)
        const background=scene.background,fog=scene.fog
        scene.background=null;scene.fog=null;scene.overrideMaterial=white;camera.layers.set(PLAYER_LAYER)
        renderer.setRenderTarget(mask);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(scene,camera)
        camera.layers.set(0);scene.overrideMaterial=null;scene.background=background;scene.fog=fog
        // strength is normalised to a 60 fps shutter so the blur looks the same at any frame rate
        uniforms.invViewProj.value.copy(viewProj).invert()
        uniforms.strength.value=level*Math.min(2,(1/60)/Math.max(dt,1e-4))
        renderer.setRenderTarget(blurTarget);renderer.render(quadScene,quadCamera)
        source=blurTarget
      }
      uniforms.prevViewProj.value.copy(viewProj);hadPrev=true

      const look={...BLOOM,...BLOOM.realm?.[realm]}
      if(look.amount>0 && source===sceneTarget){ // the blur pass already cleans its output
        renderer.setRenderTarget(cleanTarget);renderer.render(cleanScene,quadCamera);source=cleanTarget
      }
      if(look.amount>0){
        bloom.strength=look.amount;bloom.radius=look.radius;bloom.threshold=look.threshold
        bloom.highPassUniforms.smoothWidth.value=look.softness
        bloom.render(renderer,null,source,dt,false) // adds the glow into `source`
      }
      output.render(renderer,null,source)
    }
  }
}
