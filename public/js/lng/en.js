/* English language pack — self-registers into window.KeeperLang.
   To add a language, copy this file, translate the values, change the code
   in register('xx', ...), and add a <script> tag for it in index.html. */
(function(){
  var K = (window.KeeperLang = window.KeeperLang || {
    dicts:{}, order:[],
    register:function(code, meta, dict){
      this.dicts[code] = { meta:meta, dict:dict };
      if(this.order.indexOf(code)===-1) this.order.push(code);
    }
  });

  K.register('en', { name:'English', dir:'ltr' }, {
    /* header / nav */
    app_subtitle:'Recurring Activity Manager',
    btn_new:'New activity', btn_import:'Import', btn_export:'Export',
    btn_clear:'Clear all',
    lang_label:'Language',
    tab_timeline:'Timeline', tab_activities:'Activities',
    /* toolbar */
    search_ph:'Search by activity name…',
    all_categories:'All categories',
    show_finished:'Finished', show_upcoming:'Upcoming',
    btn_today:"Today's events", btn_today_active:'Showing today',
    dir_title:'Reverse order', dir_newest:'Newest first', dir_oldest:'Oldest first',
    footer:'No server, no account, no cloud. Your data stays on this page; use Export JSON to keep a copy and Import JSON to restore it.',
    /* timeline entries */
    tag_ontime:'On time', tag_late:'Late', tag_overdue:'Overdue', tag_upcoming:'Upcoming',
    due_prefix:'due {date}', day_suffix:'d',
    today_rule:'Today · {date}', today_rule_n:'Today · {date} · {n}',
    today_view_n:'Today & overdue · {date} · {n}',
    btn_done:'✓ Done', btn_skip:'Skip', btn_edit:'Edit',
    title_edit:'Edit activity', title_skip:'Skip this occurrence',
    title_done:'Mark done', title_remove:'Remove this record',
    /* activities cards */
    lbl_next_due:'Next due', n_completed:'{n} completed', avg_delay:'avg +{n}{d}',
    btn_pause:'Pause', btn_resume:'Resume', btn_delete:'Delete',
    status_active:'Active', status_paused:'Paused', status_completed:'Completed', status_archived:'Archived',
    /* empty / placeholder states */
    empty_title:'Your register is empty',
    empty_text:'Add a recurring activity or import a JSON file to begin.',
    empty_new:'＋ New activity',
    nothing_today_title:'All caught up',
    nothing_today_text:'Nothing is due today and nothing is overdue ({date}).',
    show_full:'Show full timeline',
    nothing_title:'Nothing to show',
    nothing_text:'No entries match the current search or filters.',
    /* activity modal */
    modal_new:'New activity', modal_edit:'Edit activity',
    f_name:'Activity name', f_name_ph:'e.g. Clean the pool',
    f_category:'Category', f_category_ph:'e.g. Pool',
    f_status:'Status', f_frequency:'Frequency', f_customN:'Every N days',
    f_start:'Start date', f_next:'Next due',
    f_notes:'Notes', f_notes_ph:'Optional details…',
    f_hint:'Next due is generated from the start date & frequency, but you can override it.',
    btn_cancel:'Cancel', btn_save:'Save activity',
    /* complete modal */
    modal_complete:'Mark as done', c_date:'Completed on',
    c_notes:'Notes (optional)', c_notes_ph:'What was done…',
    btn_record:'Record completion', c_what:'{name} — due {date}',
    /* frequencies */
    freq_daily:'Daily', freq_weekly:'Weekly', freq_biweekly:'Biweekly', freq_monthly:'Monthly',
    freq_quarterly:'Quarterly', freq_semiannual:'Semiannual', freq_annual:'Annual',
    freq_custom_opt:'Custom (every N days)', freq_custom_n:'Every {n} days',
    /* toasts */
    toast_name_req:'Please enter an activity name',
    toast_added:'Activity added', toast_updated:'Activity updated',
    toast_recorded:'Recorded · next due {date}', toast_skipped:'Skipped · next due {date}',
    toast_record_removed:'Record removed', toast_activity_deleted:'Activity deleted',
    toast_exported:'Exported {a} activities · {h} records',
    toast_imported:'Imported {a} activities · {h} records',
    toast_import_failed:'Import failed: {msg}', toast_read_failed:'Could not read file',
    toast_today_n:'{n} due today or overdue', toast_no_today:'Nothing due today or overdue',
    toast_deleted_activity_note:'That activity has been deleted (its record remains).',
    toast_cleared:'All data cleared', toast_already_empty:'Nothing to clear',
    /* confirms */
    confirm_delete_activity:'Delete “{name}”?\n\nIts completed history stays in the timeline as a permanent record; only the recurring schedule is removed.',
    confirm_delete_record:'Remove this completed record for “{name}” ({date})?',
    confirm_clear:'Delete ALL activities and history from this browser? This cannot be undone.\n\nTip: use Export JSON first if you want a backup.',
    /* calendar names (abbreviated) */
    months:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    weekdays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  });
})();
