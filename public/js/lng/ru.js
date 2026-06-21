/* Русский языковой пакет — саморегистрируется в window.KeeperLang. */
(function(){
  var K = (window.KeeperLang = window.KeeperLang || {
    dicts:{}, order:[],
    register:function(code, meta, dict){
      this.dicts[code] = { meta:meta, dict:dict };
      if(this.order.indexOf(code)===-1) this.order.push(code);
    }
  });

  K.register('ru', { name:'Русский', dir:'ltr' }, {
    /* шапка / навигация */
    app_subtitle:'Журнал повторяющихся дел',
    btn_new:'Новое дело', btn_import:'Импорт', btn_export:'Экспорт',
    btn_clear:'Очистить всё',
    lang_label:'Язык',
    tab_timeline:'Лента', tab_activities:'Дела',
    /* панель инструментов */
    search_ph:'Поиск по названию…',
    all_categories:'Все категории',
    show_finished:'Завершённые', show_upcoming:'Предстоящие',
    btn_today:'События сегодня', btn_today_active:'Показаны на сегодня',
    dir_title:'Изменить порядок', dir_newest:'Сначала новые', dir_oldest:'Сначала старые',
    footer:'Без сервера, без аккаунта, без облака. Данные хранятся на этой странице; используйте «Экспорт JSON», чтобы сохранить копию, и «Импорт JSON», чтобы её восстановить.',
    /* записи ленты */
    tag_ontime:'Вовремя', tag_late:'С опозданием', tag_overdue:'Просрочено', tag_upcoming:'Предстоит',
    due_prefix:'срок {date}', day_suffix:'д',
    today_rule:'Сегодня · {date}', today_rule_n:'Сегодня · {date} · {n}',
    today_view_n:'Сегодня и просроченные · {date} · {n}',
    btn_done:'✓ Готово', btn_skip:'Пропустить', btn_edit:'Изменить',
    title_edit:'Изменить дело', title_skip:'Пропустить этот срок',
    title_done:'Отметить выполненным', title_remove:'Удалить эту запись',
    /* карточки дел */
    lbl_next_due:'След. срок', n_completed:'выполнено: {n}', avg_delay:'ср. +{n}{d}',
    btn_pause:'Пауза', btn_resume:'Возобновить', btn_delete:'Удалить',
    status_active:'Активна', status_paused:'На паузе', status_completed:'Завершена', status_archived:'В архиве',
    /* пустые состояния */
    empty_title:'Журнал пуст',
    empty_text:'Добавьте повторяющееся дело или импортируйте файл JSON, чтобы начать.',
    empty_new:'＋ Новое дело',
    nothing_today_title:'Всё выполнено',
    nothing_today_text:'На сегодня ({date}) ничего не нужно и нет просроченных дел.',
    show_full:'Показать всю ленту',
    nothing_title:'Нечего показать',
    nothing_text:'Нет записей по текущему поиску или фильтрам.',
    /* окно дела */
    modal_new:'Новое дело', modal_edit:'Изменить дело',
    f_name:'Название', f_name_ph:'напр. Почистить бассейн',
    f_category:'Категория', f_category_ph:'напр. Бассейн',
    f_status:'Статус', f_frequency:'Частота', f_customN:'Каждые N дней',
    f_start:'Дата начала', f_next:'Следующий срок',
    f_notes:'Заметки', f_notes_ph:'Доп. сведения…',
    f_hint:'Следующий срок рассчитывается по дате начала и частоте, но его можно изменить вручную.',
    btn_cancel:'Отмена', btn_save:'Сохранить',
    /* окно выполнения */
    modal_complete:'Отметить выполненным', c_date:'Дата выполнения',
    c_notes:'Заметки (необязательно)', c_notes_ph:'Что было сделано…',
    btn_record:'Записать выполнение', c_what:'{name} — срок {date}',
    /* частоты */
    freq_daily:'Ежедневно', freq_weekly:'Еженедельно', freq_biweekly:'Раз в две недели', freq_monthly:'Ежемесячно',
    freq_quarterly:'Ежеквартально', freq_semiannual:'Раз в полгода', freq_annual:'Ежегодно',
    freq_custom_opt:'Свой интервал (N дней)', freq_custom_n:'Каждые {n} дн.',
    /* уведомления */
    toast_name_req:'Введите название дела',
    toast_added:'Дело добавлено', toast_updated:'Дело обновлено',
    toast_recorded:'Записано · след. срок {date}', toast_skipped:'Пропущено · след. срок {date}',
    toast_record_removed:'Запись удалена', toast_activity_deleted:'Дело удалено',
    toast_exported:'Экспортировано дел: {a} · записей: {h}',
    toast_imported:'Импортировано дел: {a} · записей: {h}',
    toast_import_failed:'Ошибка импорта: {msg}', toast_read_failed:'Не удалось прочитать файл',
    toast_today_n:'Сегодня и просрочено: {n}', toast_no_today:'Нет дел на сегодня и просроченных',
    toast_deleted_activity_note:'Это дело удалено (его запись сохранена).',
    toast_cleared:'Все данные удалены', toast_already_empty:'Нечего очищать',
    /* подтверждения */
    confirm_delete_activity:'Удалить «{name}»?\n\nЗавершённая история останется в ленте как постоянная запись; удаляется только расписание повторений.',
    confirm_delete_record:'Удалить эту запись о выполнении «{name}» ({date})?',
    confirm_clear:'Удалить ВСЕ дела и историю из этого браузера? Это действие необратимо.\n\nСовет: сначала используйте «Экспорт JSON», чтобы сохранить резервную копию.',
    /* названия календаря (сокращённо) */
    months:['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'],
    weekdays:['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
  });
})();
