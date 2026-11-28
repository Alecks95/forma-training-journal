import {
  localDay,
  dateAt,
  monday,
  shiftDay,
  displayWeight,
  doneSets,
  weeklyWeights,
  progression,
  dailyNutrition,
} from './model.js';
import {
  icon,
  esc,
  fmt,
  clockText,
  dateText,
  btn,
  smallBtn,
  pill,
  head,
  sect,
  labelIcon,
  plot,
} from './ui.js';
const tabs = ['workouts', 'history', 'exercises', 'nutrition', 'weight'];
export { tabs };
const day = () => localDay();
const plus = (action, label, extra = '') =>
  btn(action, icon('plus', 16) + label, 'primary', extra);
const link = (action, label, extra = '') =>
  btn(action, label, 'text-btn', extra);
const idAttr = (id) => 'data-id="' + esc(id) + '"';
const meter = (v, goal) =>
  '<div class="meter"><i style="width:' +
  Math.min(100, Math.max(0, (v / goal) * 100)) +
  '%"></i></div>';
const boxIcon = (i, cls = '') =>
  '<span class="metric-icon ' + cls + '">' + icon(i, 17) + '</span>';
const infoRow = (glyph, title, sub) =>
  '<div class="empty-row"><span class="row-icon">' +
  icon(glyph) +
  '</span><div><strong>' +
  title +
  '</strong>' +
  sub +
  '</div></div>';
const rows = (content) => '<div class="list">' + content + '</div>';
const rowInner = (glyph, title, sub) =>
  '<div class="row-main"><span class="row-icon">' +
  icon(glyph, 18) +
  '</span><div><strong>' +
  esc(title) +
  '</strong><small>' +
  esc(sub) +
  '</small></div></div>';
function listRow(glyph, title, sub, actions = '') {
  return (
    '<div class="row">' +
    rowInner(glyph, title, sub) +
    '<div class="row-icons">' +
    actions +
    '</div></div>'
  );
}
const setCount = (count) => count + (count === 1 ? ' set' : ' sets');
const sortedSessions = (s) => [...s.sessions].sort((a, b) => b.ended - a.ended);
function daySessions(list) {
  return rows(
    list
      .map((w) =>
        btn(
          'session-detail',
          rowInner(
            'workouts',
            w.name,
            new Date(w.started).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }) +
              ' · ' +
              doneSets(w).length +
              ' sets',
          ) + icon('chevron', 16),
          'row row-link',
          idAttr(w.id),
        ),
      )
      .join(''),
  );
}
function routineRow(r, s, expanded) {
  const items = r.items
    .map((item) => {
      const exercise = s.exercises.find((e) => e.id === item.exerciseId);
      return (
        '<li><strong>' +
        esc(exercise.name) +
        '</strong><small>' +
        setCount(item.sets) +
        ' · ' +
        clockText(item.rest) +
        ' rest</small></li>'
      );
    })
    .join('');
  const edit = btn('routine-edit', 'Edit routine', 'button', idAttr(r.id));
  let start = '';
  if (!s.active && items)
    start = btn(
      'start',
      icon('play', 15) + 'Start routine',
      'start-routine',
      idAttr(r.id),
    );
  else if (s.active?.routineId === r.id)
    start = btn('resume', 'Resume workout', 'start-routine');
  return (
    '<details class="routine" name="workout-routines" data-routine="' +
    esc(r.id) +
    '"' +
    (expanded ? ' open' : '') +
    '><summary><strong>' +
    esc(r.name) +
    '</strong>' +
    icon('chevron', 16) +
    '</summary><div class="routine-detail">' +
    (items
      ? '<ul class="routine-lines">' + items + '</ul>'
      : '<p class="subhead">No exercises in this routine.</p>') +
    '<div class="button-row">' +
    start +
    edit +
    '</div></div></details>'
  );
}
function workoutScreen(s, c) {
  return (
    head(
      'Workout',
      s.active
        ? btn('resume', 'Resume workout', 'primary')
        : btn(
            'empty-start',
            icon('plus', 16) + 'Start empty workout',
            'primary',
          ),
    ) +
    (s.active
      ? '<div class="active-banner"><div><strong>' +
        esc(s.active.name) +
        '</strong><small>Workout in progress</small></div>' +
        btn('resume', 'Resume', 'button') +
        '</div>'
      : '') +
    sect(
      'My routines',
      btn('routine-new', icon('plus', 16) + 'New routine', 'text-btn'),
    ) +
    (s.routines.length
      ? '<div class="routines">' +
        s.routines.map((r) => routineRow(r, s, c.routine === r.id)).join('') +
        '</div>'
      : rows(
          infoRow(
            'book',
            'No routines',
            'Use New routine to save exercises, sets and rest times.',
          ),
        ))
  );
}
function historyScreen(s, c) {
  const today = day();
  const month = c.historyMonth || today.slice(0, 7);
  const first = month + '-01';
  const start = dateAt(first);
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1, 12);
  const daysInMonth = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const offset = (start.getDay() + 6) % 7;
  const sessions = sortedSessions(s).filter((w) =>
    w.day.startsWith(month + '-'),
  );
  const counts = new Map();
  for (const w of sessions) counts.set(w.day, (counts.get(w.day) || 0) + 1);
  const monthName = dateText(first, { month: 'long', year: 'numeric' });
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((d) => '<span class="weekday">' + d + '</span>')
    .join('');
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const date = month + '-' + String(i + 1).padStart(2, '0');
    const count = counts.get(date);
    const cls = 'calendar-day' + (date === today ? ' today' : '');
    const current = date === today ? ' aria-current="date"' : '';
    const firstColumn =
      i === 0 ? ' style="grid-column-start:' + (offset + 1) + '"' : '';
    if (!count)
      return (
        '<span class="' +
        cls +
        '"' +
        firstColumn +
        current +
        '>' +
        (i + 1) +
        '</span>'
      );
    return btn(
      'history-day',
      String(i + 1),
      cls + ' trained',
      'data-day="' +
        date +
        '" aria-label="' +
        dateText(date, { month: 'long', day: 'numeric', year: 'numeric' }) +
        ', ' +
        count +
        (count === 1 ? ' workout' : ' workouts') +
        '" aria-pressed="' +
        (date === c.historyDay) +
        '"' +
        current +
        firstColumn,
    );
  }).join('');
  const selected = sessions.filter((w) => w.day === c.historyDay);
  return (
    head('History') +
    '<div class="activity-history"><section class="activity-calendar" aria-label="Workout calendar"><div class="card-top">' +
    '<h2 aria-live="polite">' +
    monthName +
    '</h2><div class="button-row">' +
    smallBtn(
      'history-month',
      'Previous month',
      'left',
      'data-month="' + shiftDay(first, -1).slice(0, 7) + '"',
    ) +
    smallBtn(
      'history-month',
      'Next month',
      'chevron',
      'data-month="' +
        localDay(next).slice(0, 7) +
        '"' +
        (month >= today.slice(0, 7) ? ' disabled' : ''),
    ) +
    '</div></div><div class="calendar-grid">' +
    weekdays +
    cells +
    '</div><div class="calendar-key"><span>Workout day</span><span>' +
    sessions.length +
    (sessions.length === 1 ? ' workout' : ' workouts') +
    ' this month</span></div></section>' +
    (selected.length
      ? sect(
          dateText(c.historyDay, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          }),
        ) + daySessions(selected)
      : '') +
    '</div>'
  );
}
function nutrition(s, c) {
  const d = c.foodDay,
    t = dailyNutrition(s.meals, d),
    entries = s.meals.filter((m) => m.day === d).reverse();
  const dateNav =
    '<div class="date-nav">' +
    smallBtn('day-prev', 'Previous day', 'left') +
    '<input class="date-control" aria-label="Food log date" type="date" id="food-day" value="' +
    esc(d) +
    '" max="' +
    day() +
    '">' +
    smallBtn('day-next', 'Next day', 'chevron', d >= day() ? 'disabled' : '') +
    '</div>';
  return (
    head('Nutrition', dateNav) +
    '<div class="grid-wide"><section class="card"><div class="card-top"><h3>' +
    boxIcon('flame', 'green') +
    'Daily intake</h3>' +
    link('goals', 'Edit goals') +
    '</div><div class="data-large">' +
    fmt(t.kcal) +
    ' <span>/ ' +
    fmt(s.goals.kcal) +
    ' kcal</span></div>' +
    meter(t.kcal, s.goals.kcal) +
    '<div class="macro-grid">' +
    ['protein', 'carbs', 'fat']
      .map(
        (k) =>
          '<div><label>' +
          k[0].toUpperCase() +
          k.slice(1) +
          '</label>' +
          meter(t[k], s.goals[k]) +
          '<small>' +
          fmt(t[k]) +
          ' / ' +
          fmt(s.goals[k]) +
          ' g</small></div>',
      )
      .join('') +
    '</div></section>' +
    '<section class="card"><span class="tag">' +
    icon('nutrition', 16) +
    'Food log</span><h2 class="space-top">' +
    (d === day() ? 'Today’s entries' : dateText(d)) +
    '</h2><p class="subhead">' +
    entries.length +
    ' food ' +
    (entries.length === 1 ? 'entry' : 'entries') +
    ' logged</p>' +
    plus('meal-new', 'Log food') +
    '</section></div>' +
    sect('Food diary') +
    rows(
      entries.length
        ? entries
            .map((m) =>
              listRow(
                'nutrition',
                m.name,
                fmt(m.servings) +
                  ' × ' +
                  m.portion +
                  ' · ' +
                  fmt(m.kcal * m.servings) +
                  ' kcal',
                smallBtn(
                  'meal-delete',
                  'Remove food entry',
                  'bin',
                  idAttr(m.id),
                ),
              ),
            )
            .join('')
        : infoRow(
            'nutrition',
            'No food logged',
            'Choose a saved food and enter your servings.',
          ),
    ) +
    sect(
      'Food library',
      btn('food-new', icon('plus', 15) + 'New food', 'button'),
    ) +
    rows(
      s.foods.length
        ? s.foods
            .map((f) =>
              listRow(
                'leaf',
                f.name,
                f.portion + ' · ' + fmt(f.kcal) + ' kcal',
                smallBtn('food-edit', 'Edit ' + f.name, 'edit', idAttr(f.id)) +
                  smallBtn('meal-new', 'Log ' + f.name, 'plus', idAttr(f.id)),
              ),
            )
            .join('')
        : infoRow(
            'leaf',
            'Your reusable foods',
            'Save a food once with its portion, calories and macros.',
          ),
    )
  );
}
function weight(s) {
  const ws = weeklyWeights(s.weights),
    start = monday(day()),
    curr = ws.find((w) => w.day === start),
    prev = ws.find((w) => w.day === shiftDay(start, -7)),
    diff = curr && prev ? displayWeight(curr.value - prev.value, s.unit) : null;
  const list = [...s.weights].sort((a, b) => b.day.localeCompare(a.day));
  const val = (w) =>
    w ? fmt(displayWeight(w.value, s.unit)) + ' ' + s.unit : '—';
  return (
    head('Body weight', plus('weight-new', 'Log weight')) +
    '<div class="grid-wide"><section class="card"><div class="card-top"><h3>' +
    boxIcon('weight', 'blue') +
    'Weekly average</h3>' +
    pill(s.unit) +
    '</div>' +
    plot(
      ws.map((w) => ({ ...w, value: displayWeight(w.value, s.unit) })),
      s.unit,
    ) +
    '<p class="chart-note">One point per week with a weigh-in.</p></section>' +
    '<section class="card"><span class="tag">' +
    icon('calendar', 16) +
    'This week</span><div class="data-large">' +
    (curr ? fmt(displayWeight(curr.value, s.unit)) : '—') +
    ' <span>' +
    s.unit +
    '</span></div><p class="subhead">' +
    (curr
      ? curr.count + ' weigh-in' + (curr.count === 1 ? '' : 's') + ' this week'
      : 'No weigh-ins this week') +
    '</p><div class="split-stats"><div><small>Last week</small><strong>' +
    val(prev) +
    '</strong></div><div><small>Difference</small><strong>' +
    (diff === null ? '—' : (diff > 0 ? '+' : '') + fmt(diff) + ' ' + s.unit) +
    '</strong></div></div><p class="chart-note">Weeks start Monday.</p></section></div>' +
    sect('Weigh-ins') +
    rows(
      list.length
        ? list
            .map((w) =>
              listRow(
                'weight',
                fmt(displayWeight(w.kg, s.unit)) + ' ' + s.unit,
                dateText(w.day, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }),
                smallBtn(
                  'weight-edit',
                  'Edit weigh-in',
                  'edit',
                  'data-day="' + w.day + '"',
                ) +
                  smallBtn(
                    'weight-delete',
                    'Delete weigh-in',
                    'bin',
                    'data-day="' + w.day + '"',
                  ),
              ),
            )
            .join('')
        : infoRow(
            'weight',
            'No weigh-ins yet',
            'Log your weight to start your weekly average.',
          ),
    )
  );
}
function exercises(s, c) {
  const library = new Map(s.exercises.map((e) => [e.id, e]));
  // Deleted library entries can still have recorded sets in History.
  for (const w of sortedSessions(s)) {
    for (const item of w.items) {
      if (!library.has(item.exerciseId) && item.sets.some((set) => set.done)) {
        library.set(item.exerciseId, {
          id: item.exerciseId,
          name: item.name + ' (history)',
        });
      }
    }
  }
  const current = library.get(c.exercise) || library.values().next().value,
    points = current ? progression(s.sessions, current.id) : [];
  const selected = Math.min(c.graphSet ?? points.length - 1, points.length - 1);
  const point = points[selected];
  const inspector = point
    ? '<label class="field space-top"><span>Inspect set</span><select id="graph-set">' +
      points
        .map(
          (p, i) =>
            '<option value="' +
            i +
            '" ' +
            (selected === i ? 'selected' : '') +
            '>' +
            (i + 1) +
            ' of ' +
            points.length +
            ' · ' +
            dateText(p.day, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) +
            ' · ' +
            esc(p.workout) +
            ' · Set ' +
            p.setNumber +
            '</option>',
        )
        .join('') +
      '</select></label>'
    : '';
  const options = [...library.values()]
    .map(
      (e) =>
        '<option value="' +
        e.id +
        '" ' +
        (e.id === current?.id ? 'selected' : '') +
        '>' +
        esc(e.name) +
        '</option>',
    )
    .join('');
  return (
    head('Exercises', plus('exercise-new', 'New exercise')) +
    (current
      ? '<label class="field"><span>Exercise progression</span><select id="exercise-select" class="select">' +
        options +
        '</select></label>' +
        inspector +
        '<div class="grid2 space-top">' +
        [
          ['kg', 'Weight per set', s.unit],
          ['reps', 'Reps per set', 'reps'],
        ]
          .map(
            ([k, title, unit]) =>
              '<section class="card"><div class="card-top"><h3>' +
              boxIcon(k === 'kg' ? 'workouts' : 'activity', 'green') +
              title +
              '</h3>' +
              pill(
                point
                  ? fmt(
                      k === 'kg' ? displayWeight(point.kg, s.unit) : point.reps,
                    ) +
                      ' ' +
                      unit
                  : unit,
              ) +
              '</div>' +
              plot(
                points.map((p) => ({
                  ...p,
                  value: k === 'kg' ? displayWeight(p.kg, s.unit) : p.reps,
                })),
                unit,
                { selectedSet: selected },
              ) +
              '</section>',
          )
          .join('') +
        '</div>'
      : '') +
    sect('Exercise library') +
    rows(
      s.exercises.length
        ? s.exercises
            .map((e) =>
              listRow(
                'workouts',
                e.name,
                setCount(e.sets) + ' · ' + clockText(e.rest) + ' rest',
                smallBtn(
                  'exercise-view',
                  'View ' + e.name + ' progress',
                  'exercises',
                  idAttr(e.id),
                ) +
                  smallBtn(
                    'exercise-edit',
                    'Edit ' + e.name,
                    'edit',
                    idAttr(e.id),
                  ),
              ),
            )
            .join('')
        : infoRow(
            'workouts',
            'No exercises yet',
            'Create a movement to use it in your routines.',
          ),
    )
  );
}
function previousSets(s, id) {
  for (const w of sortedSessions(s)) {
    const sets = w.items
      .filter((e) => e.exerciseId === id)
      .flatMap((e) => e.sets);
    if (sets.some((t) => t.done)) return sets;
  }
  return [];
}
function activeExercise(s, item) {
  const entry =
    'data-entry="' + item.entryId + '" data-workout="' + s.active.id + '"';
  const previous = previousSets(s, item.exerciseId);
  const tableHead =
    '<div class="set-line set-labels"><span>Set</span><span>Previous</span><span>' +
    s.unit +
    '</span><span>Reps</span><span>RIR</span><span>' +
    icon('check', 15) +
    '</span></div>';
  const rows = item.sets
    .map((t, j) => {
      const prev = previous[j],
        data = entry + ' data-set-id="' + t.entryId + '"',
        prevText = prev?.done
          ? fmt(displayWeight(prev.kg, s.unit)) + ' × ' + prev.reps
          : '—';
      const inputs = [
        ['kg', t.kg == null ? '' : displayWeight(t.kg, s.unit)],
        ['reps', t.reps ?? ''],
        ['rir', t.rir ?? ''],
      ]
        .map(
          ([key, v]) =>
            '<input type="number" inputmode="' +
            (key === 'kg' ? 'decimal' : 'numeric') +
            '" aria-label="' +
            esc(item.name) +
            ' set ' +
            (j + 1) +
            ' ' +
            (key === 'kg' ? s.unit : key) +
            '" value="' +
            v +
            '" min="' +
            (key === 'reps' ? 1 : 0) +
            '" max="' +
            (key === 'reps' ? 999 : key === 'rir' ? 20 : 100000) +
            '" step="' +
            (key === 'kg' ? 'any' : 1) +
            '" placeholder="—" ' +
            (key === 'kg' ? 'title="Enter 0 for bodyweight" ' : '') +
            'required data-set="' +
            key +
            '" ' +
            data +
            '>',
        )
        .join('');
      return (
        '<div class="set-line ' +
        (t.done ? 'done' : '') +
        '"><span class="set-number">' +
        (j + 1) +
        '</span><span class="previous">' +
        prevText +
        '</span>' +
        inputs +
        btn(
          'set-check',
          icon('check', 18),
          'set-check',
          'aria-label="' +
            (t.done ? 'Uncheck' : 'Complete') +
            ' set ' +
            (j + 1) +
            ' of ' +
            esc(item.name) +
            '" aria-pressed="' +
            t.done +
            '" ' +
            data,
        ) +
        '</div>'
      );
    })
    .join('');
  return (
    '<section class="run-card"><div class="card-top"><h3>' +
    esc(item.name) +
    '</h3><div class="button-row">' +
    btn(
      'rest-edit',
      icon('timer', 15) + clockText(item.rest),
      'rest-control',
      entry + ' aria-label="Edit rest for ' + esc(item.name) + '"',
    ) +
    smallBtn('manage-exercise', 'Manage ' + item.name, 'menu', entry) +
    '</div></div>' +
    tableHead +
    rows +
    '<div class="set-actions">' +
    btn('set-add', icon('plus', 14) + 'Add set', 'text-btn', entry) +
    (item.sets.length > 1 && !item.sets.at(-1).done
      ? btn(
          'set-remove',
          'Remove last set',
          'muted-action',
          entry + ' data-set-id="' + item.sets.at(-1).entryId + '"',
        )
      : '') +
    '</div></section>'
  );
}
export function runner(s) {
  const a = s.active;
  if (!a) return workoutScreen(s, {});
  const done = doneSets(a),
    total = a.items.reduce((n, i) => n + i.sets.length, 0);
  const volume = done.reduce((sum, t) => sum + t.kg * t.reps, 0),
    rest = Math.max(0, Math.ceil((a.restUntil - Date.now()) / 1000));
  return (
    head(
      a.name,
      btn('finish', 'Finish', 'finish-button', done.length ? '' : 'disabled'),
    ) +
    '<div class="run-summary"><div><small>Duration</small><strong id="elapsed">' +
    clockText(Math.max(0, Math.floor((Date.now() - a.started) / 1000))) +
    '</strong></div><div><small>Volume</small><strong>' +
    fmt(displayWeight(volume, s.unit)) +
    ' ' +
    s.unit +
    '</strong></div><div><small>Sets</small><strong>' +
    done.length +
    ' / ' +
    total +
    '</strong></div></div>' +
    '<div class="rest-bar ' +
    (rest ? '' : 'hide') +
    '" id="rest-bar" aria-label="Rest timer"><div>' +
    icon('timer', 18) +
    ' <strong id="timer-count">' +
    clockText(rest) +
    '</strong> rest</div><div class="button-row">' +
    btn('rest-add', '+15s', 'button') +
    btn('rest-skip', 'Skip', 'button') +
    '</div></div>' +
    (a.items.length
      ? '<div class="session-exercises">' +
        a.items.map((i) => activeExercise(s, i)).join('') +
        '</div>'
      : '<p class="subhead">Add your first exercise to start logging sets.</p>') +
    '<div class="run-footer">' +
    btn(
      'session-exercise',
      icon('plus', 16) + 'Add exercise',
      'start-routine',
    ) +
    btn(
      'workout-options',
      icon('menu', 20),
      'icon-button more-actions',
      'aria-label="Workout options"',
    ) +
    '</div>'
  );
}
export function renderView(route, s, c) {
  return (
    {
      workouts: workoutScreen,
      history: historyScreen,
      nutrition,
      weight,
      exercises,
      run: runner,
    }[route] || workoutScreen
  )(s, c);
}
