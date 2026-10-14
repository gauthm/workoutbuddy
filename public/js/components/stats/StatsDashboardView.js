import { reactive, onMounted, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { stats as api } from '../../api.js'
import { t, i18n } from '../../i18n.js'
import { formatDate } from '../../utils/date.js'
import PageHeader from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner from '../common/ErrorBanner.js'
import VolumeChart from './VolumeChart.js'
import PRList from './PRList.js'

export default {
  name:'StatsDashboardView',components:{PageHeader,LoadingSpinner,ErrorBanner,VolumeChart,PRList},
  setup(){
    const router=inject('router')
    const state=reactive({loading:true,error:null,overview:null,volume:[],records:[],weeks:12,groupBy:'week',metric:'volume',chartLoading:false,chartError:null,showAllRecords:false})
    let revision=0
    async function load(){
      state.loading=true;state.error=null
      try{
        const [overview,volume,records]=await Promise.all([api.overview(),api.volume({weeks:state.weeks,group_by:state.groupBy}),api.records()])
        state.overview=overview;state.volume=volume.data;state.records=records.records
        if(overview.total_volume_kg===0 && volume.data.some(row=>row.sets>0))state.metric='sets'
      }catch(error){state.error=error.message}finally{state.loading=false}
    }
    async function loadChart(){
      const request=++revision
      state.chartLoading=true;state.chartError=null
      try{
        const response=await api.volume({weeks:state.weeks,group_by:state.groupBy})
        if(request===revision)state.volume=response.data
      }catch(error){if(request===revision)state.chartError=error.message}
      finally{if(request===revision)state.chartLoading=false}
    }
    const number=value=>Number(value||0).toLocaleString(i18n.locale,{maximumFractionDigits:1})
    const summary=computed(()=>state.volume.reduce((sum,row)=>sum+Number(state.metric==='sets'?row.sets||0:row.volume_kg||0),0))
    const cards=computed(()=>state.overview?[
      {key:'sessions',label:'stats.sessions_total',value:number(state.overview.total_sessions)},
      {key:'streak',label:'stats.current_streak',value:number(state.overview.current_week_streak)},
      {key:'volume',label:'stats.total_volume',value:number(state.overview.total_volume_kg)+' kg'},
      {key:'records',label:'stats.personal_records',value:number(state.overview.personal_records_count)},
    ]:[])
    onMounted(load)
    return{state,router,t,cards,summary,number,load,loadChart,date:value=>formatDate(value,i18n.locale==='fr'?'fr-FR':'en-GB')}
  },
  template:`
    <div class="view stats-dashboard"><PageHeader :title="t('stats.title')" />
      <div class="view__content">
        <LoadingSpinner v-if="state.loading" /><ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />
        <template v-else-if="state.overview">
          <section class="stats-section stats-summary">
            <h2>{{t('stats.since_start')}}</h2>
            <p class="stats-context" v-if="state.overview.active_program_name">{{state.overview.active_program_name}}</p>
            <div class="stats-metric-grid"><div v-for="card in cards" :key="card.key" class="stats-metric">
              <strong>{{card.value}}</strong><span>{{t(card.label)}}</span>
            </div></div>
            <div class="stats-consistency"><span>{{t('stats.best_streak_short',{n:state.overview.longest_week_streak})}}</span><span>{{t('stats.trained_weeks_short',{n:state.overview.total_weeks_trained})}}</span></div>
            <p class="stats-context" v-if="state.overview.last_session_date">{{t('stats.last_session',{date:date(state.overview.last_session_date)})}}</p>
          </section>
          <section v-if="!state.overview.total_sessions" class="stats-empty">
            <strong>{{t('stats.start_tracking')}}</strong><p>{{t('stats.start_tracking_description')}}</p>
          </section>
          <section class="stats-section">
            <h2>{{t('stats.training_activity')}}</h2>
            <div class="stats-chart-controls">
              <label>{{t('stats.period')}}<select class="form-select" :aria-label="t('stats.period')" v-model.number="state.weeks" @change="loadChart()">
                <option v-for="n in [4,12,24]" :key="n" :value="n">{{t('stats.weeks_period',{n})}}</option>
              </select></label>
              <label>{{t('stats.grouping')}}<select class="form-select" :aria-label="t('stats.grouping')" v-model="state.groupBy" @change="loadChart()">
                <option value="week">{{t('stats.by_week')}}</option><option value="muscle">{{t('stats.by_muscle')}}</option>
              </select></label>
            </div>
            <div class="stats-segmented" :aria-label="t('stats.metric')" role="group">
              <button type="button" :aria-pressed="state.metric==='volume'" @click="state.metric='volume'">{{t('stats.volume')}}</button>
              <button type="button" :aria-pressed="state.metric==='sets'" @click="state.metric='sets'">{{t('stats.sets')}}</button>
            </div>
            <p class="stats-context">{{state.metric==='sets' ? t('stats.sets_help') : t('stats.volume_help')}}</p>
            <ErrorBanner v-if="state.chartError" :message="state.chartError" :retry="loadChart" />
            <LoadingSpinner v-else-if="state.chartLoading" />
            <template v-else>
              <div class="stats-period-total" v-if="state.volume.length"><strong>{{number(summary)}} {{state.metric==='sets'?t('stats.sets_unit'):'kg'}}</strong><span>{{t('stats.selected_period')}}</span></div>
              <VolumeChart v-if="state.volume.length" :data="state.volume" :group-by="state.groupBy" :metric="state.metric" canvas-id="volume-chart-main" />
              <p v-else class="stats-context stats-chart-empty">{{t('stats.no_data')}}</p>
            </template>
          </section>
          <section class="stats-section">
            <h2>{{t('stats.personal_records')}}</h2><p class="stats-context">{{t('stats.records_help')}}</p>
            <PRList :records="state.records" :limit="state.showAllRecords ? state.records.length : 5" />
            <button v-if="state.records.length>5" class="btn btn--secondary btn--full" :aria-expanded="state.showAllRecords" @click="state.showAllRecords=!state.showAllRecords">
              {{state.showAllRecords?t('stats.see_fewer_records'):t('stats.see_all_records')}}
            </button>
          </section>
          <section class="stats-section stats-bodyweight-link">
            <button class="btn btn--secondary btn--full" @click="router.push('#/stats/bodyweight')">{{t('stats.bodyweight_link')}}</button>
          </section>
        </template>
      </div>
    </div>`,
}
