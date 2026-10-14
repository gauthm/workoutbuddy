import { ref,computed,onMounted,onUnmounted,watch } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name:'ExerciseMotion',
  props:{paths:{type:Array,required:true},name:{type:String,required:true},maxHeight:{type:Number,default:220}},
  setup(props){
    const root=ref(null),playing=ref(true),animating=ref(false),index=ref(0),loaded=ref([]),failed=ref([])
    const available=computed(()=>props.paths.map((_,i)=>i).filter(i=>!failed.value.includes(i)))
    const current=computed(()=>available.value.includes(index.value)?index.value:available.value[0])
    let timer=null,observer=null,media=null,visible=false
    const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;animating.value=false}
    function sync(){
      stop()
      const frames=available.value.filter(i=>loaded.value.includes(i))
      if(!playing.value || !visible || document.hidden || frames.length<2)return
      animating.value=true
      timer=setInterval(()=>{index.value=frames[(frames.indexOf(current.value)+1)%frames.length]},1100)
    }
    function onLoad(i){if(!loaded.value.includes(i))loaded.value=[...loaded.value,i];sync()}
    function onError(i){failed.value=[...failed.value,i];sync()}
    function toggle(){playing.value=!playing.value;sync()}
    function preference(){playing.value=!media.matches;sync()}
    watch(()=>props.paths,()=>{index.value=0;loaded.value=[];failed.value=[];sync()})
    onMounted(()=>{
      media=window.matchMedia('(prefers-reduced-motion: reduce)');preference()
      media.addEventListener('change',preference)
      document.addEventListener('visibilitychange',sync)
      observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()})
      observer.observe(root.value)
    })
    onUnmounted(()=>{stop();observer?.disconnect();media?.removeEventListener('change',preference);document.removeEventListener('visibilitychange',sync)})
    return{root,playing,animating,current,available,t,onLoad,onError,toggle}
  },
  template:`
    <div ref="root" class="exercise-motion" :data-animating="animating" :style="{'--motion-height':maxHeight+'px'}">
      <div v-if="available.length" class="exercise-motion__frames">
        <img v-for="(path,i) in paths" :key="path" :src="'/exercises/images/'+path" :alt="name"
          :aria-hidden="i!==current" class="exercise-motion__frame" :class="{'exercise-motion__frame--visible':i===current}"
          @load="onLoad(i)" @error="onError(i)" />
      </div>
      <p v-else class="inventory-hint">{{t('exercises.images_unavailable')}}</p>
      <div v-if="available.length>1" class="exercise-motion__controls">
        <button type="button" class="btn btn--secondary btn--sm" :aria-pressed="playing" @click="toggle()">
          {{t(playing?'exercises.motion_pause':'exercises.motion_play')}}
        </button>
        <span aria-live="off">{{available.indexOf(current)+1}} / {{available.length}}</span>
      </div>
    </div>`,
}
