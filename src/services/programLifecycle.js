import { localIsoDate } from './date.js'
export function programDates(program,today=localIsoDate()) {
  if (!program?.started_on || program.duration_weeks==null) return {ends_on:null,end_exclusive:null,is_finished:false}
  const end=new Date(program.started_on+'T12:00:00Z')
  end.setUTCDate(end.getUTCDate()+program.duration_weeks*7)
  const end_exclusive=end.toISOString().slice(0,10)
  end.setUTCDate(end.getUTCDate()-1)
  return {ends_on:end.toISOString().slice(0,10),end_exclusive,is_finished:today>=end_exclusive}
}
export function cannotStartProgram(program,date=localIsoDate()) {
  const dates=programDates(program)
  return dates.is_finished || !!(dates.end_exclusive && date>=dates.end_exclusive)
}
