(function(){
'use strict';

/* ===========================================================================
   1. CONSTANTS
   =========================================================================== */
var FREQUENCIES = {
  daily:      {label:'Daily',        interval:1,  unit:'day'},
  weekly:     {label:'Weekly',       interval:7,  unit:'day'},
  biweekly:   {label:'Biweekly',     interval:14, unit:'day'},
  monthly:    {label:'Monthly',      interval:1,  unit:'month'},
  quarterly:  {label:'Quarterly',    interval:3,  unit:'month'},
  semiannual: {label:'Semiannual',   interval:6,  unit:'month'},
  annual:     {label:'Annual',       interval:12, unit:'month'},
  custom:     {label:'Custom (every N days)', interval:0, unit:'day'}
};
var DEFAULT_CATEGORIES = ['Pool','Lawn & Garden','HVAC','Appliances','Vehicle','Financial','Health','Home Maintenance'];
var LS_KEY = 'keeper.state.v1';
var LANG_KEY = 'keeper.lang';
var UPCOMING_MAX = 4;            // hard cap on projected occurrences per activity
var UPCOMING_HORIZON_DAYS = 90;  // only project beyond the next date if within this window

/* ===========================================================================
   1b. LOCALIZATION — dictionaries are registered by js/lng/*.js into the
   global window.KeeperLang. t(key,vars) looks up the current language, falls
   back to English, then to the key itself. {placeholders} are interpolated.
   =========================================================================== */
var FALLBACK_LANG = 'en';
var curLang = FALLBACK_LANG;
function registry(){ return window.KeeperLang || { dicts:{}, order:[] }; }
function dictFor(code){ var r=registry(); return (r.dicts[code] && r.dicts[code].dict) || {}; }
function availableLangs(){ var r=registry(); return (r.order && r.order.length) ? r.order : Object.keys(r.dicts); }
function t(key, vars){
  var d=dictFor(curLang), en=dictFor(FALLBACK_LANG);
  var s = (d[key]!=null) ? d[key] : (en[key]!=null ? en[key] : key);
  if(vars && typeof s==='string'){
    s = s.replace(/\{(\w+)\}/g, function(_,k){ return vars[k]!=null ? vars[k] : '{'+k+'}'; });
  }
  return s;
}
function pickInitialLang(){
  var saved=null; try{ saved=localStorage.getItem(LANG_KEY); }catch(e){}
  var avail=availableLangs();
  if(saved && avail.indexOf(saved)!==-1) return saved;
  var nav=(navigator.language||'en').slice(0,2).toLowerCase();
  if(avail.indexOf(nav)!==-1) return nav;
  return (avail.indexOf(FALLBACK_LANG)!==-1) ? FALLBACK_LANG : (avail[0]||FALLBACK_LANG);
}

/* ===========================================================================
   2. DATE UTILITIES (YYYY-MM-DD treated as local midnight)
   =========================================================================== */
function todayISO(){ return toISO(new Date()); }
function parseDate(iso){ var p=String(iso).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); }
function toISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonthsAnchored(d,n,idealDay){
  var x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n);
  var last=new Date(x.getFullYear(), x.getMonth()+1, 0).getDate();
  x.setDate(Math.min(idealDay,last)); return x;
}
function daysBetween(aIso,bIso){ return Math.round((parseDate(bIso)-parseDate(aIso))/86400000); }
var EN_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var EN_MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function months(){ var m=dictFor(curLang).months; return (m&&m.length===12)?m:EN_MO; }
function weekdays(){ var w=dictFor(curLang).weekdays; return (w&&w.length===7)?w:EN_WD; }
function fmtDate(iso){ var d=parseDate(iso); return d.getDate()+' '+months()[d.getMonth()]+' '+d.getFullYear(); }
function weekday(iso){ return weekdays()[parseDate(iso).getDay()]; }

/* one interval forward from `iso`, respecting the activity's frequency */
function advance(iso, act){
  var f=FREQUENCIES[act.frequencyType]||FREQUENCIES.monthly, base=parseDate(iso);
  if(act.frequencyType==='custom'){ return toISO(addDays(base, Math.max(1,Number(act.customDays)||1))); }
  if(f.unit==='month'){ var ideal=parseDate(act.startDate||iso).getDate(); return toISO(addMonthsAnchored(base,f.interval,ideal)); }
  return toISO(addDays(base,f.interval));
}
function freqLabel(act){
  if(act.frequencyType==='custom') return t('freq_custom_n',{n:Number(act.customDays)||0});
  return t('freq_'+act.frequencyType);
}

/* ===========================================================================
   3. STATE + PERSISTENCE (localStorage is best-effort only)
   =========================================================================== */
var state = { activities:[], history:[], categories:[] };
var ui = { tab:'timeline', search:'', category:'', showFinished:true, showUpcoming:true, direction:'desc', todayOnly:false };

function uid(){
  try{ if(crypto && crypto.randomUUID) return crypto.randomUUID().slice(0,8); }catch(e){}
  return Math.random().toString(36).slice(2,10);
}
function accession(id){ return 'REG-'+String(id).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8).padEnd(8,'0'); }

function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){ /* file:// may block; that's fine */ }
}
function load(){
  try{
    var raw=localStorage.getItem(LS_KEY);
    if(raw){ var s=JSON.parse(raw);
      if(s && s.activities){ state.activities=s.activities||[]; state.history=s.history||[]; state.categories=s.categories||[]; return true; }
    }
  }catch(e){}
  return false;
}

/* ===========================================================================
   4. PROJECTIONS — build the unified chronological list
   =========================================================================== */
/* Project upcoming due-dates for an activity:
   - always include the next due date (index 0), even if it's far off or overdue;
   - include further occurrences only while they fall within `horizonDays` of today;
   - never return more than `maxCount` (keeps frequent activities from flooding). */
function upcomingOccurrences(act, maxCount, horizonDays){
  var out=[], cur=act.nextDueDate;
  var horizon=toISO(addDays(parseDate(todayISO()), horizonDays));
  for(var i=0;i<maxCount;i++){
    if(i>0 && cur>horizon) break;   // beyond the window and not the next date → stop
    out.push(cur);
    cur=advance(cur, act);
  }
  return out;
}

function buildTimeline(){
  var today=todayISO();
  var entries=[];

  // finished (from permanent history)
  if(ui.showFinished){
    state.history.forEach(function(h){
      entries.push({
        kind:'finished', date:h.completedDate, dueDate:h.dueDate,
        name:h.activityName, category:h.category, delayDays:h.delayDays, notes:h.notes||'',
        activityId:h.activityId, recordId:h.id
      });
    });
  }
  // upcoming (projected from active activities)
  if(ui.showUpcoming){
    state.activities.forEach(function(a){
      if(a.status!=='active') return;
      var occ=upcomingOccurrences(a, UPCOMING_MAX, UPCOMING_HORIZON_DAYS);
      occ.forEach(function(d, idx){
        entries.push({
          kind:'upcoming', date:d, name:a.name, category:a.category,
          actionable:(idx===0), activityId:a.id, overdue:(d < today)
        });
      });
    });
  }

  // search + category filter
  var q=ui.search.trim().toLowerCase();
  entries=entries.filter(function(e){
    if(ui.category && e.category!==ui.category) return false;
    if(q && e.name.toLowerCase().indexOf(q)===-1) return false;
    // "Today" view = entries dated today PLUS every overdue (past-due, not-yet-done) item
    if(ui.todayOnly && !(e.date===today || (e.kind==='upcoming' && e.date<today))) return false;
    return true;
  });

  // chronological order; tie-break finished before upcoming on the same day.
  // direction 'asc' = oldest first, 'desc' = newest first (reversed timeline).
  var dir = ui.direction==='asc' ? 1 : -1;
  entries.sort(function(a,b){
    if(a.date!==b.date) return a.date<b.date ? -dir : dir;
    return (a.kind==='finished'?0:1)-(b.kind==='finished'?0:1);
  });
  return entries;
}

/* ===========================================================================
   6. RENDERING
   =========================================================================== */
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

function renderTimeline(){
  var host=el('timelineView'); var entries=buildTimeline(); var today=todayISO();
  if(!state.activities.length && !state.history.length){
    host.innerHTML=emptyState(); return;
  }
  if(ui.todayOnly && !entries.length){
    host.innerHTML='<div class="empty"><h2>'+esc(t('nothing_today_title'))+'</h2><p>'+esc(t('nothing_today_text',{date:fmtDate(today)}))+'</p>'+
      '<div style="margin-top:14px"><button class="btn" onclick="document.getElementById(\'btnToday\').click()">'+esc(t('show_full'))+'</button></div></div>';
    return;
  }
  if(!entries.length){ host.innerHTML='<div class="empty"><h2>'+esc(t('nothing_title'))+'</h2><p>'+esc(t('nothing_text'))+'</p></div>'; return; }

  // Grouped by year (one ledger rail per year) with a single Today rule
  // inserted where the timeline crosses today's date (works in both directions).
  var html='', curYear=null, todayPlaced=false, openLedger=false;
  var asc = ui.direction==='asc';
  // crossing test: asc => first entry on/after today; desc => first entry before today
  function crossesToday(date){ return asc ? (date>=today) : (date<today); }

  if(ui.todayOnly){
    html+='<div class="today-rule">'+esc(t('today_view_n',{date:fmtDate(today),n:entries.length}))+'</div>';
  }
  entries.forEach(function(e){
    var y=e.date.slice(0,4);
    if(y!==curYear){
      if(openLedger){ html+='</div>'; openLedger=false; }
      curYear=y; html+='<div class="year-rule">'+y+'</div><div class="ledger">'; openLedger=true;
    }
    if(!ui.todayOnly && !todayPlaced && crossesToday(e.date)){
      html+='<div class="today-rule">'+esc(t('today_rule',{date:fmtDate(today)}))+'</div>';
      todayPlaced=true;
    }
    html+=entryHTML(e, today);
  });
  if(openLedger) html+='</div>';
  if(!ui.todayOnly && !todayPlaced){ html+='<div class="today-rule">'+esc(t('today_rule',{date:fmtDate(today)}))+'</div>'; }
  host.innerHTML=html;
}

function entryHTML(e, today){
  var cls=e.kind, tag, right='', dsuf=t('day_suffix');
  if(e.kind==='finished'){
    var late=e.delayDays>0;
    tag = late
      ? '<span class="tag late">'+esc(t('tag_late'))+'</span><span class="delay pos">+'+e.delayDays+esc(dsuf)+'</span>'
      : '<span class="tag done">'+esc(t('tag_ontime'))+'</span><span class="delay zero">0'+esc(dsuf)+'</span>';
    // small activity buttons on finished rows
    if(e.activityId) right+='<button class="btn btn-xs btn-ghost" data-edit="'+esc(e.activityId)+'" title="'+esc(t('title_edit'))+'">'+esc(t('btn_edit'))+'</button>';
    right+='<button class="btn btn-xs btn-ghost btn-danger" data-delrec="'+esc(e.recordId)+'" title="'+esc(t('title_remove'))+'">✕</button>';
  } else {
    if(e.overdue){ cls+=' overdue'; tag='<span class="tag over">'+esc(t('tag_overdue'))+'</span>'; }
    else { tag='<span class="tag due">'+esc(t('tag_upcoming'))+'</span>'; }
    // small activity buttons on upcoming rows
    if(e.actionable){
      right+='<button class="btn btn-xs btn-accent" data-complete="'+esc(e.activityId)+'" title="'+esc(t('title_done'))+'">'+esc(t('btn_done'))+'</button>';
      right+='<button class="btn btn-xs btn-ghost" data-skip="'+esc(e.activityId)+'" title="'+esc(t('title_skip'))+'">'+esc(t('btn_skip'))+'</button>';
    }
    if(e.activityId) right+='<button class="btn btn-xs btn-ghost" data-edit="'+esc(e.activityId)+'" title="'+esc(t('title_edit'))+'">'+esc(t('btn_edit'))+'</button>';
  }
  var due = (e.kind==='finished') ? ('<span class="chip">'+esc(t('due_prefix',{date:fmtDate(e.dueDate)}))+'</span>') : '';
  var note = e.notes ? '<div class="note">“'+esc(e.notes)+'”</div>' : '';
  return ''+
    '<div class="entry '+cls+'">'+
      '<span class="dot"></span>'+
      '<div class="when"><span class="wd">'+weekday(e.date)+'</span>'+fmtDate(e.date)+'</div>'+
      '<div class="body">'+
        '<div class="ttl">'+esc(e.name)+'</div>'+
        '<div class="meta">'+tag+'<span class="chip">'+esc(e.category)+'</span>'+due+'</div>'+
        note+
      '</div>'+
      '<div class="right">'+right+'</div>'+
    '</div>';
}

function emptyState(){
  return '<div class="empty">'+
    '<div class="crest">K</div>'+
    '<h2>'+esc(t('empty_title'))+'</h2>'+
    '<p>'+esc(t('empty_text'))+'</p>'+
    '<div style="margin-top:16px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap">'+
      '<button class="btn btn-accent" onclick="document.getElementById(\'btnAdd\').click()">'+esc(t('empty_new'))+'</button>'+
    '</div></div>';
}

function renderActivities(){
  var host=el('activitiesView');
  if(!state.activities.length){ host.innerHTML=emptyState(); return; }
  var order={active:0,paused:1,completed:2,archived:3};
  var acts=state.activities.slice().sort(function(a,b){
    var s=(order[a.status]||0)-(order[b.status]||0); if(s) return s;
    return a.nextDueDate<b.nextDueDate?-1:1;
  });
  var html='<div class="act-grid">';
  acts.forEach(function(a){
    var hist=state.history.filter(function(h){return h.activityId===a.id;});
    var done=hist.length;
    var avg = done ? Math.round(hist.reduce(function(s,h){return s+Math.max(0,h.delayDays);},0)/done*10)/10 : 0;
    html+=''+
    '<div class="act-card">'+
      '<div style="flex:1; min-width:0">'+
        '<div class="acc">'+accession(a.id)+'</div>'+
        '<h3>'+esc(a.name)+'</h3>'+
        '<div class="info">'+
          '<span><b>'+esc(a.category)+'</b></span>'+
          '<span>'+esc(freqLabel(a))+'</span>'+
          '<span>'+esc(t('lbl_next_due'))+' <b>'+fmtDate(a.nextDueDate)+'</b></span>'+
          '<span>'+esc(t('n_completed',{n:done}))+(done?(' · '+esc(t('avg_delay',{n:avg,d:t('day_suffix')}))):'')+'</span>'+
          '<span class="status-pill s-'+a.status+'">'+esc(t('status_'+a.status))+'</span>'+
        '</div>'+
        (a.notes?'<div class="note" style="margin-top:6px">“'+esc(a.notes)+'”</div>':'')+
      '</div>'+
      '<div class="ctrls">'+
        (a.status==='active'?'<button class="btn btn-sm btn-accent" data-complete="'+esc(a.id)+'">'+esc(t('btn_done'))+'</button>':'')+
        (a.status==='active'?'<button class="btn btn-sm" data-pause="'+esc(a.id)+'">'+esc(t('btn_pause'))+'</button>':'')+
        (a.status==='paused'?'<button class="btn btn-sm" data-resume="'+esc(a.id)+'">'+esc(t('btn_resume'))+'</button>':'')+
        '<button class="btn btn-sm" data-edit="'+esc(a.id)+'">'+esc(t('btn_edit'))+'</button>'+
        '<button class="btn btn-sm btn-danger" data-delete="'+esc(a.id)+'">'+esc(t('btn_delete'))+'</button>'+
      '</div>'+
    '</div>';
  });
  html+='</div>';
  host.innerHTML=html;
}

function render(){
  el('toolbar').style.display = ui.tab==='timeline' ? 'flex':'none';
  el('timelineView').style.display = ui.tab==='timeline' ? 'block':'none';
  el('activitiesView').style.display = ui.tab==='activities' ? 'block':'none';
  if(ui.tab==='timeline') renderTimeline(); else renderActivities();
  refreshCategoryControls();
}

function refreshCategoryControls(){
  var present=presentCategories(), cur=ui.category;
  // Filter dropdown reflects only categories actually present in the register.
  el('filterCat').innerHTML='<option value="">'+esc(t('all_categories'))+'</option>'+present.map(function(c){return '<option'+(c===cur?' selected':'')+'>'+esc(c)+'</option>';}).join('');
  // The new-activity field suggests the built-in categories plus any in use — as hints only, never auto-added.
  el('catList').innerHTML=suggestionCategories().map(function(c){return '<option value="'+esc(c)+'">';}).join('');
}
/* categories actually used by stored activities/history (plus user-added) */
function presentCategories(){
  var set={}; state.categories.forEach(function(c){if(c)set[c]=1;});
  state.activities.forEach(function(a){if(a.category)set[a.category]=1;});
  state.history.forEach(function(h){if(h.category)set[h.category]=1;});
  return Object.keys(set).sort();
}
/* suggestion list for the category input: built-in hints unioned with present ones */
function suggestionCategories(){
  var set={}; DEFAULT_CATEGORIES.forEach(function(c){set[c]=1;});
  presentCategories().forEach(function(c){set[c]=1;});
  return Object.keys(set).sort();
}

/* ===========================================================================
   7. MODALS — activity form
   =========================================================================== */
function openModal(id){ el(id).classList.add('show'); }
function closeModal(id){ el(id).classList.remove('show'); }

function populateFreqSelect(){
  el('fFreq').innerHTML=Object.keys(FREQUENCIES).map(function(k){
    var label = (k==='custom') ? t('freq_custom_opt') : t('freq_'+k);
    return '<option value="'+k+'">'+esc(label)+'</option>';
  }).join('');
}
function toggleCustom(){ el('customWrap').style.display = el('fFreq').value==='custom' ? 'block':'none'; }

function openActivityForm(act){
  el('amTitle').textContent = act ? t('modal_edit') : t('modal_new');
  el('fId').value      = act ? act.id : '';
  el('fName').value    = act ? act.name : '';
  el('fCategory').value= act ? act.category : 'Home Maintenance';
  el('fStatus').value  = act ? act.status : 'active';
  el('fFreq').value    = act ? act.frequencyType : 'monthly';
  el('fCustom').value  = act ? (act.customDays||30) : 30;
  el('fStart').value   = act ? act.startDate : todayISO();
  el('fNext').value    = act ? act.nextDueDate : todayISO();
  toggleCustom();
  openModal('activityModal');
  setTimeout(function(){ el('fName').focus(); },50);
  el('fNotes').value = act ? (act.notes||'') : '';
}

function saveActivityForm(){
  var name=el('fName').value.trim();
  if(!name){ toast(t('toast_name_req')); el('fName').focus(); return; }
  var id=el('fId').value;
  var existing = id ? state.activities.filter(function(a){return a.id===id;})[0] : null;
  var freq=el('fFreq').value;
  var start=el('fStart').value || todayISO();
  var next=el('fNext').value || start;
  var draft={
    id: existing?existing.id:uid(),
    name:name,
    category: el('fCategory').value.trim() || 'Home Maintenance',
    frequencyType:freq,
    customDays: Math.max(1, Number(el('fCustom').value)||30),
    startDate:start,
    nextDueDate:next,
    notes: el('fNotes').value.trim(),
    status: el('fStatus').value,
    createdDate: existing?existing.createdDate:todayISO(),
    updatedAt:new Date().toISOString()
  };
  if(existing){ for(var k in draft) existing[k]=draft[k]; }
  else { state.activities.push(draft); }
  if(state.categories.indexOf(draft.category)===-1) state.categories.push(draft.category);
  save(); closeModal('activityModal'); render();
  toast(existing?t('toast_updated'):t('toast_added'));
}

/* recompute next due from start + frequency when the user changes them in the form */
function autoNextDue(){
  var tmp={frequencyType:el('fFreq').value, customDays:Number(el('fCustom').value)||30, startDate:el('fStart').value||todayISO()};
  // project from start to first occurrence >= today
  var cur=tmp.startDate, today=todayISO(), guard=0;
  while(cur<today && guard<400){ cur=advance(cur,tmp); guard++; }
  el('fNext').value=cur;
}

/* ===========================================================================
   8. COMPLETION
   =========================================================================== */
function openComplete(activityId){
  var a=state.activities.filter(function(x){return x.id===activityId;})[0]; if(!a) return;
  el('cId').value=a.id;
  el('cWhat').innerHTML='<b>'+esc(a.name)+'</b> — '+esc(t('due_prefix',{date:fmtDate(a.nextDueDate)}));
  el('cDate').value=todayISO();
  el('cNotes').value='';
  openModal('completeModal');
}
function confirmComplete(){
  var a=state.activities.filter(function(x){return x.id===el('cId').value;})[0]; if(!a) return;
  var due=a.nextDueDate, completed=el('cDate').value||todayISO();
  state.history.push({
    id:uid(), activityId:a.id, activityName:a.name, category:a.category,
    dueDate:due, completedDate:completed, delayDays:daysBetween(due,completed), notes:el('cNotes').value.trim()
  });
  a.nextDueDate=advance(due, a);
  a.updatedAt=new Date().toISOString();
  save(); closeModal('completeModal'); render();
  toast(t('toast_recorded',{date:fmtDate(a.nextDueDate)}));
}

/* ===========================================================================
   9. STATUS / DELETE
   =========================================================================== */
function setStatus(id,status){
  var a=state.activities.filter(function(x){return x.id===id;})[0]; if(!a) return;
  a.status=status; a.updatedAt=new Date().toISOString(); save(); render();
}
function deleteActivity(id){
  var a=state.activities.filter(function(x){return x.id===id;})[0]; if(!a) return;
  if(!confirm(t('confirm_delete_activity',{name:a.name}))) return;
  state.activities=state.activities.filter(function(x){return x.id!==id;});
  save(); render(); toast(t('toast_activity_deleted'));
}
/* skip the current (next-due) occurrence without recording a completion */
function skipOccurrence(id){
  var a=state.activities.filter(function(x){return x.id===id;})[0]; if(!a) return;
  a.nextDueDate=advance(a.nextDueDate, a); a.updatedAt=new Date().toISOString();
  save(); render(); toast(t('toast_skipped',{date:fmtDate(a.nextDueDate)}));
}
/* remove a single completed record from the permanent history */
function deleteRecord(id){
  var r=state.history.filter(function(h){return h.id===id;})[0]; if(!r) return;
  if(!confirm(t('confirm_delete_record',{name:r.activityName,date:fmtDate(r.completedDate)}))) return;
  state.history=state.history.filter(function(h){return h.id!==id;});
  save(); render(); toast(t('toast_record_removed'));
}

/* ===========================================================================
   10. IMPORT / EXPORT (JSON) — works from file://
   =========================================================================== */
function exportJSON(){
  var payload={ app:'The Keeper', schema:1, exportedAt:new Date().toISOString(),
    activities:state.activities, history:state.history, categories:state.categories };
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='keeper-register-'+todayISO()+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); },1000);
  toast(t('toast_exported',{a:state.activities.length, h:state.history.length}));
}
function importJSON(file){
  var r=new FileReader();
  r.onload=function(){
    try{
      var data=JSON.parse(r.result);
      if(!data || (!data.activities && !data.history)) throw new Error('not a Keeper file');
      state.activities=(data.activities||[]).map(normalizeActivity);
      state.history=(data.history||[]).map(normalizeHistory);
      state.categories=(data.categories&&data.categories.length)?data.categories:[];
      save(); render();
      toast(t('toast_imported',{a:state.activities.length, h:state.history.length}));
    }catch(e){ toast(t('toast_import_failed',{msg:e.message})); }
  };
  r.onerror=function(){ toast(t('toast_read_failed')); };
  r.readAsText(file);
}
function normalizeActivity(a){
  return {
    id:a.id||uid(), name:a.name||a.title||'Untitled', category:a.category||'Home Maintenance',
    frequencyType: FREQUENCIES[a.frequencyType]?a.frequencyType:'monthly',
    customDays:Number(a.customDays)||30, startDate:a.startDate||todayISO(),
    nextDueDate:a.nextDueDate||a.startDate||todayISO(), notes:a.notes||'',
    status:a.status||'active', createdDate:a.createdDate||a.startDate||todayISO(),
    updatedAt:a.updatedAt||new Date().toISOString()
  };
}
function normalizeHistory(h){
  return {
    id:h.id||uid(), activityId:h.activityId||'', activityName:h.activityName||h.title||'Activity',
    category:h.category||'Home Maintenance', dueDate:h.dueDate||h.completedDate||todayISO(),
    completedDate:h.completedDate||h.dueDate||todayISO(),
    delayDays:(h.delayDays!=null)?h.delayDays:daysBetween(h.dueDate||todayISO(),h.completedDate||todayISO()),
    notes:h.notes||''
  };
}

/* ===========================================================================
   11. TOAST
   =========================================================================== */
function toast(msg){
  var node=document.createElement('div'); node.className='toast'; node.textContent=msg;
  el('toastWrap').appendChild(node);
  requestAnimationFrame(function(){ node.classList.add('show'); });
  setTimeout(function(){ node.classList.remove('show'); setTimeout(function(){ node.remove(); },300); }, 2600);
}

/* ===========================================================================
   11b. LANGUAGE SWITCHING — apply translations to static DOM + change language
   =========================================================================== */
function applyStaticI18n(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function(node){
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function(node){
    node.setAttribute('placeholder', t(node.getAttribute('data-i18n-ph')));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-title]'), function(node){
    node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
  });
  updateToggleLabels();
}
/* the two toggle buttons carry state-dependent text, set after the generic pass */
function updateToggleLabels(){
  var tl=el('todayLabel'); if(tl) tl.textContent = ui.todayOnly ? t('btn_today_active') : t('btn_today');
  var btn=el('btnToday'); if(btn){ var ic=btn.querySelector('.ico'); if(ic) ic.textContent = ui.todayOnly ? '◉' : '◎'; }
  var dl=el('dirLabel'); if(dl) dl.textContent = ui.direction==='asc' ? t('dir_oldest') : t('dir_newest');
  var di=el('dirIcon'); if(di) di.textContent = ui.direction==='asc' ? '↑' : '↓';
}
function buildLangSwitcher(){
  var sel=el('langSelect'); if(!sel) return;
  var r=registry(), codes=availableLangs();
  sel.innerHTML=codes.map(function(c){
    var name=(r.dicts[c] && r.dicts[c].meta && r.dicts[c].meta.name) || c;
    return '<option value="'+c+'"'+(c===curLang?' selected':'')+'>'+esc(name)+'</option>';
  }).join('');
  sel.value=curLang;
  sel.addEventListener('change', function(){ setLang(this.value); });
}
function setLang(code){
  var avail=availableLangs();
  curLang = (avail.indexOf(code)!==-1) ? code : (avail.indexOf(FALLBACK_LANG)!==-1 ? FALLBACK_LANG : (avail[0]||FALLBACK_LANG));
  try{ localStorage.setItem(LANG_KEY, curLang); }catch(e){}
  var meta=(registry().dicts[curLang]||{}).meta||{};
  document.documentElement.setAttribute('lang', curLang);
  document.documentElement.setAttribute('dir', meta.dir||'ltr');
  var sel=el('langSelect'); if(sel) sel.value=curLang;
  populateFreqSelect();   // re-localize frequency options
  applyStaticI18n();      // re-localize all static DOM
  render();               // re-localize dynamic content
}

/* ===========================================================================
   12. WIRING
   =========================================================================== */
function init(){
  // language first, so freq options and static DOM localize correctly
  curLang = pickInitialLang();
  buildLangSwitcher();
  populateFreqSelect();

  // tabs
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(b){
    b.addEventListener('click', function(){
      ui.tab=b.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(x){x.classList.toggle('active', x===b);});
      render();
    });
  });

  // header actions
  el('btnAdd').addEventListener('click', function(){ openActivityForm(null); });
  el('btnExport').addEventListener('click', exportJSON);
  el('btnImport').addEventListener('click', function(){ el('importFile').click(); });
  el('importFile').addEventListener('change', function(e){ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=''; });
  el('btnClear').addEventListener('click', function(){
    if(!state.activities.length && !state.history.length){ toast(t('toast_already_empty')); return; }
    if(!confirm(t('confirm_clear'))) return;
    state.activities=[]; state.history=[]; state.categories=[];
    try{ localStorage.removeItem(LS_KEY); }catch(e){}
    ui.search=''; ui.category=''; ui.todayOnly=false;
    var sb=el('search'); if(sb) sb.value='';
    var bt=el('btnToday'); if(bt) bt.classList.remove('active');
    updateToggleLabels();
    render();
    toast(t('toast_cleared'));
  });

  // toolbar
  el('search').addEventListener('input', function(){ ui.search=this.value; renderTimeline(); });
  el('filterCat').addEventListener('change', function(){ ui.category=this.value; renderTimeline(); });
  el('showFinished').addEventListener('change', function(){ ui.showFinished=this.checked; renderTimeline(); });
  el('showUpcoming').addEventListener('change', function(){ ui.showUpcoming=this.checked; renderTimeline(); });

  // Today's events — toggle a filter that shows only entries dated today
  el('btnToday').addEventListener('click', function(){
    ui.todayOnly=!ui.todayOnly;
    this.classList.toggle('active', ui.todayOnly);
    updateToggleLabels();
    // make sure we're on the timeline tab
    if(ui.tab!=='timeline'){
      ui.tab='timeline';
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(x){x.classList.toggle('active', x.getAttribute('data-tab')==='timeline');});
    }
    render();
    window.scrollTo({top:0, behavior:'smooth'});
    if(ui.todayOnly){
      var n=buildTimeline().length;
      toast(n ? t('toast_today_n',{n:n}) : t('toast_no_today'));
    }
  });

  // Reverse timeline direction
  el('btnDir').addEventListener('click', function(){
    ui.direction = ui.direction==='asc' ? 'desc' : 'asc';
    updateToggleLabels();
    renderTimeline();
  });

  // form modal
  el('fFreq').addEventListener('change', function(){ toggleCustom(); autoNextDue(); });
  el('fStart').addEventListener('change', autoNextDue);
  el('fCustom').addEventListener('change', autoNextDue);
  el('amSave').addEventListener('click', saveActivityForm);

  // complete modal
  el('cSave').addEventListener('click', confirmComplete);

  // generic close + backdrop click + esc
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function(b){
    b.addEventListener('click', function(){ closeModal('activityModal'); closeModal('completeModal'); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.backdrop'), function(bd){
    bd.addEventListener('click', function(e){ if(e.target===bd) bd.classList.remove('show'); });
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeModal('activityModal'); closeModal('completeModal'); } });

  // event delegation for dynamic buttons
  document.addEventListener('click', function(e){
    var tg=e.target.closest('[data-complete],[data-edit],[data-delete],[data-pause],[data-resume],[data-skip],[data-delrec]');
    if(!tg) return;
    if(tg.hasAttribute('data-complete')) openComplete(tg.getAttribute('data-complete'));
    else if(tg.hasAttribute('data-skip')) skipOccurrence(tg.getAttribute('data-skip'));
    else if(tg.hasAttribute('data-delrec')) deleteRecord(tg.getAttribute('data-delrec'));
    else if(tg.hasAttribute('data-edit')){
      var ea=state.activities.filter(function(a){return a.id===tg.getAttribute('data-edit');})[0];
      if(ea) openActivityForm(ea); else toast(t('toast_deleted_activity_note'));
    }
    else if(tg.hasAttribute('data-delete')) deleteActivity(tg.getAttribute('data-delete'));
    else if(tg.hasAttribute('data-pause')) setStatus(tg.getAttribute('data-pause'),'paused');
    else if(tg.hasAttribute('data-resume')) setStatus(tg.getAttribute('data-resume'),'active');
  });

  // first paint
  document.documentElement.setAttribute('lang', curLang);
  applyStaticI18n();              // localize static DOM for the chosen language
  load();                        // restore saved data if any; otherwise start empty (no defaults)
  render();
}

document.addEventListener('DOMContentLoaded', init);
})();
