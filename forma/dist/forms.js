import {
  uid,
  startSession,
  localDay,
  displayWeight,
  kgWeight,
  macros,
  validState,
  doneSets,
} from './model.js';
import {
  btn,
  smallBtn,
  field,
  esc,
  icon,
  fmt,
  dateText,
  clockText,
} from './ui.js';
const getText = (fd, key) => {
  const v = String(fd.get(key) ?? '').trim();
  if (!v || v.length > 100)
    throw Error('Enter a name or portion between 1 and 100 characters.');
  return v;
};
const num = (fd, key) => Number(fd.get(key));
const options = (list, selected) =>
  list
    .map(
      (o) =>
        '<option value="' +
        o.id +
        '" ' +
        (o.id === selected ? 'selected' : '') +
        '>' +
        esc(o.name) +
        '</option>',
    )
    .join('');
const selectField = (label, key, opts) =>
  '<label class="field"><span>' +
  label +
  '</span><select name="' +
  key +
  '" required>' +
  opts +
  '</select></label>';
const dateField = (val, readonly = false) =>
  '<label class="field"><span>Date</span><input name="day" type="date" required min="1900-01-01" max="' +
  localDay() +
  '" value="' +
  esc(val) +
  '" ' +
  (readonly ? 'readonly' : '') +
  '></label>';
const grid = (html, three = false) =>
  '<div class="form-grid ' + (three ? 'three' : '') + '">' + html + '</div>';
const unitOptions = (unit) =>
  ['kg', 'lb']
    .map(
      (u) =>
        '<option ' +
        (u === unit ? 'selected' : '') +
        ' value="' +
        u +
        '">' +
        (u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)') +
        '</option>',
    )
    .join('');
const nutritionFields = (obj) =>
  grid(
    [
      ['kcal', 'Calories (kcal)'],
      ['protein', 'Protein (g)'],
      ['carbs', 'Carbs (g)'],
      ['fat', 'Fat (g)'],
    ]
      .map(([k, label]) => field(label, k, obj[k], { max: 1000000 }))
      .join(''),
  );
const assertName = (records, name, id) => {
  if (
    records.some(
      (r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw Error('That name is already in your library.');
};
function targets(x, unit, prefix = '') {
  return (
    grid(
      field('Sets', prefix + 'sets', x.sets, { min: 1, max: 100, step: 1 }) +
        field('Reps', prefix + 'reps', x.reps, { min: 1, max: 999, step: 1 }) +
        field(
          'Weight (' + unit + ')',
          prefix + 'load',
          displayWeight(x.kg, unit),
          { max: 100000 },
        ),
      true,
    ) +
    grid(
      field('Reps in reserve', prefix + 'rir', x.rir, { max: 20, step: 1 }) +
        field('Rest (seconds)', prefix + 'rest', x.rest, {
          max: 3600,
          step: 1,
        }),
    )
  );
}
function readTargets(fd, unit, p = '') {
  return {
    sets: num(fd, p + 'sets'),
    reps: num(fd, p + 'reps'),
    kg: kgWeight(num(fd, p + 'load'), unit),
    rir: num(fd, p + 'rir'),
    rest: num(fd, p + 'rest'),
  };
}
function upsert(arr, record) {
  const i = arr.findIndex((x) => x.id === record.id);
  if (i === -1) arr.push(record);
  else arr[i] = record;
}
export function buildForms(env) {
  const { state, ctx, save, sheet, form, confirm, toast, go, draw } = env;
  function exercise(id, onSaved) {
    const unit = state().unit,
      existing = state().exercises.find((e) => e.id === id),
      x = existing || { name: '', sets: 3, reps: 8, kg: 0, rir: 2, rest: 90 };
    form(
      existing ? 'Edit exercise' : 'New exercise',
      field('Exercise name', 'name', x.name, { type: 'text' }) +
        targets(x, unit) +
        '<p class="chart-note">These defaults fill new routines. Use 0 weight for bodyweight exercises.</p>',
      'Save exercise',
      async (fd) => {
        const record = {
          id: existing?.id || uid(),
          name: getText(fd, 'name'),
          ...readTargets(fd, unit),
        };
        await save((s) => {
          assertName(s.exercises, record.name, record.id);
          upsert(s.exercises, record);
        });
        onSaved?.(record);
        toast('Exercise saved');
      },
    );
  }
  function routine(id) {
    const unit = state().unit,
      old = state().routines.find((r) => r.id === id),
      items = old?.items || [];
    const dlg = form(
      old ? 'Edit routine' : 'New routine',
      field('Routine name', 'name', old?.name || '', { type: 'text' }) +
        '<div class="row-between"><h3>Exercises</h3>' +
        btn('inline', 'New exercise', 'text-btn', 'data-new-exercise') +
        '</div><div class="stack" data-items></div><div class="button-row">' +
        '<select class="select" style="flex:1" aria-label="Exercise to add" data-pick>' +
        options(state().exercises, null) +
        '</select>' +
        btn('inline', icon('plus', 16) + 'Add', 'button', 'data-add') +
        '</div>',
      'Save routine',
      async (fd, d) => {
        const items = [...d.querySelectorAll('[data-row]')].map((el) => ({
          exerciseId: el.dataset.exercise,
          ...readTargets(fd, unit, el.dataset.row + '-'),
        }));
        if (!items.length)
          throw Error('Add at least one exercise to the routine.');
        const record = {
          id: old?.id || uid(),
          name: getText(fd, 'name'),
          items,
        };
        await save((s) => {
          assertName(s.routines, record.name, record.id);
          upsert(s.routines, record);
        });
        ctx.routine = record.id;
        draw();
        toast('Routine saved');
      },
    );
    let sequence = 0;
    const list = dlg.querySelector('[data-items]'),
      picker = dlg.querySelector('[data-pick]');
    function addItem(eid, values) {
      const e = state().exercises.find((e) => e.id === eid);
      if (!e) return;
      const block = document.createElement('div');
      block.className = 'plan-item';
      block.dataset.row = String(++sequence);
      block.dataset.exercise = eid;
      block.innerHTML =
        '<div class="row-between"><strong>' +
        esc(e.name) +
        '</strong>' +
        smallBtn('inline', 'Remove ' + e.name, 'bin', 'data-remove') +
        '</div>' +
        targets(values || e, unit, sequence + '-');
      block.querySelector('[data-remove]').onclick = () => block.remove();
      list.append(block);
    }
    items.forEach((i) => addItem(i.exerciseId, i));
    dlg.querySelector('[data-add]').onclick = () => addItem(picker.value);
    dlg.querySelector('[data-new-exercise]').onclick = () =>
      exercise(null, (e) => {
        picker.innerHTML = options(state().exercises, e.id);
        addItem(e.id);
      });
  }
  function food(id, onSaved) {
    const old = state().foods.find((f) => f.id === id),
      f = old || {
        name: '',
        portion: '',
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
    form(
      old ? 'Edit food' : 'New food',
      field('Food name', 'name', f.name, { type: 'text' }) +
        field('Portion (e.g. 100 g or 1 slice)', 'portion', f.portion, {
          type: 'text',
        }) +
        nutritionFields(f),
      'Save food',
      async (fd) => {
        const record = {
          id: old?.id || uid(),
          name: getText(fd, 'name'),
          portion: getText(fd, 'portion'),
          ...Object.fromEntries(macros.map((k) => [k, num(fd, k)])),
        };
        await save((s) => {
          assertName(s.foods, record.name, record.id);
          upsert(s.foods, record);
        });
        onSaved?.(record);
        toast('Food saved');
      },
    );
  }
  function meal(id, date = ctx.foodDay) {
    if (!state().foods.length) {
      food(null, (f) => {
        queueMicrotask(() => meal(f.id, date));
      });
      return;
    }
    const first = id || state().foods[0].id;
    const dlg = form(
      'Log food',
      selectField('Saved food', 'foodId', options(state().foods, first)) +
        btn(
          'inline',
          icon('plus', 15) + 'Create food',
          'text-btn',
          'data-new-food',
        ) +
        '<p data-portion></p>' +
        grid(
          field('Servings', 'servings', 1, {
            min: 0.01,
            max: 1000,
            step: 0.01,
          }) + dateField(date),
        ),
      'Log food',
      async (fd) => {
        const day = String(fd.get('day')),
          servings = num(fd, 'servings'),
          fid = fd.get('foodId');
        await save((s) => {
          const f = s.foods.find((x) => x.id === fid);
          if (!f) throw Error('Choose an existing food.');
          s.meals.push({ ...f, id: uid(), foodId: fid, servings, day });
        });
        ctx.foodDay = day;
        draw();
        toast('Food logged');
      },
    );
    const select = dlg.querySelector('[name=foodId]');
    function hint() {
      const f = state().foods.find((f) => f.id === select.value);
      dlg.querySelector('[data-portion]').textContent = f
        ? 'Per ' + f.portion + ' · ' + fmt(f.kcal) + ' kcal'
        : '';
    }
    hint();
    select.onchange = hint;
    dlg.querySelector('[data-new-food]').onclick = () =>
      food(null, (f) => {
        select.innerHTML = options(state().foods, f.id);
        hint();
      });
  }
  function goals() {
    form(
      'Daily goals',
      nutritionFields(state().goals),
      'Save goals',
      async (fd) => {
        const goals = Object.fromEntries(macros.map((k) => [k, num(fd, k)]));
        if (macros.some((k) => goals[k] <= 0))
          throw Error('Enter a goal above zero for each nutrient.');
        await save((s) => {
          s.goals = goals;
        });
        toast('Daily goals saved');
      },
    );
  }
  function weigh(day) {
    const s = state(),
      old = day ? s.weights.find((w) => w.day === day) : null;
    const dlg = form(
      old ? 'Edit weigh-in' : 'Log weight',
      dateField(day || localDay(), !!old) +
        grid(
          field(
            'Body weight',
            'amount',
            old ? displayWeight(old.kg, s.unit) : '',
            { min: 0.01, max: 4500 },
          ) + selectField('Unit', 'unit', unitOptions(s.unit)),
        ) +
        '<p class="chart-note" data-weight-hint></p>',
      'Save weigh-in',
      async (fd) => {
        const date = String(fd.get('day')),
          kg = kgWeight(num(fd, 'amount'), fd.get('unit'));
        if (kg < 0.01 || kg > 2000)
          throw Error('Enter a body weight between 0.01 and 2,000 kg.');
        await save((s) => {
          const w = s.weights.find((w) => w.day === date);
          if (w) w.kg = kg;
          else s.weights.push({ day: date, kg });
        });
        toast('Weigh-in saved');
      },
    );
    const hint = () => {
      const d = dlg.querySelector('[name=day]').value;
      dlg.querySelector('[data-weight-hint]').textContent =
        state().weights.some((w) => w.day === d)
          ? 'Saving updates the existing weigh-in for this date.'
          : 'One weigh-in per day contributes to the weekly average.';
    };
    dlg.querySelector('[name=day]').onchange = hint;
    hint();
  }
  function sessionDetails(id) {
    const s = state(),
      w = s.sessions.find((x) => x.id === id);
    if (!w) return;
    sheet(
      w.name,
      '<p>' +
        dateText(w.day, { weekday: 'long', month: 'long', day: 'numeric' }) +
        ' · ' +
        doneSets(w).length +
        ' completed sets · ' +
        Math.max(1, Math.round((w.ended - w.started) / 60000)) +
        ' min</p><div class="stack space-top">' +
        w.items
          .filter((i) => i.sets.some((t) => t.done))
          .map(
            (i) =>
              '<div class="plan-item"><strong>' +
              esc(i.name) +
              '</strong><div class="history-sets">' +
              i.sets
                .filter((t) => t.done)
                .map(
                  (t) =>
                    '<span>' +
                    fmt(displayWeight(t.kg, s.unit)) +
                    ' ' +
                    s.unit +
                    ' × ' +
                    t.reps +
                    ' · ' +
                    t.rir +
                    ' RIR</span>',
                )
                .join('') +
              '</div></div>',
          )
          .join('') +
        '</div>',
    );
  }
  function settings() {
    const unit = state().unit;
    const dlg = sheet(
      'Settings',
      '<div class="form-body"><div><h3>Weight unit</h3><p class="subhead">Used for lifts, weigh-ins and charts.</p><div class="segmented">' +
        ['kg', 'lb']
          .map((u) =>
            btn(
              'inline',
              u === 'kg' ? 'kg' : 'lb',
              'segment ' + (u === unit ? 'active' : ''),
              'data-unit="' + u + '" aria-pressed="' + (u === unit) + '"',
            ),
          )
          .join('') +
        '</div></div>' +
        '<div class="settings-group"><h3>Journal backup</h3><p>Your entries stay on this device. Export a copy to restore them here or on a new phone.</p><div class="button-row">' +
        btn('inline', 'Export backup', 'button', 'data-export') +
        btn('inline', 'Restore backup', 'button', 'data-restore') +
        '</div><input type="file" accept=".json,application/json" hidden data-file></div>' +
        '<div class="settings-group"><h3>Use on iPhone</h3><p>In Safari’s Share menu, choose Add to Home Screen. Open Forma from that icon to keep using the same journal.</p><span class="on-device"><i></i><span id="offline-status">Checking offline availability…</span></span></div><div class="form-error" role="alert"></div></div>',
    );
    const offline = dlg.querySelector('#offline-status');
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          offline.textContent = reg?.active
            ? 'Available offline on this device'
            : 'Keep Forma open online to prepare offline access.';
        })
        .catch(() => (offline.textContent = 'Offline setup unavailable.'));
    else offline.textContent = 'Offline setup unavailable in this browser.';
    dlg.querySelectorAll('[data-unit]').forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await save((s) => {
              s.unit = b.dataset.unit;
            });
            dlg.querySelectorAll('[data-unit]').forEach((el) => {
              el.classList.toggle('active', el.dataset.unit === state().unit);
              el.setAttribute('aria-pressed', el.dataset.unit === state().unit);
            });
            toast('Weight unit saved');
          } catch (e) {
            dlg.querySelector('.form-error').textContent = e.message;
          }
        }),
    );
    dlg.querySelector('[data-export]').onclick = async () => {
      try {
        const fresh = await env.refresh();
        const blob = new Blob(
          [JSON.stringify({ app: 'Forma', journal: fresh }, null, 2)],
          { type: 'application/json' },
        );
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'forma-backup-' + localDay() + '.json';
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast('Backup ready');
      } catch (e) {
        dlg.querySelector('.form-error').textContent = e.message;
      }
    };
    const input = dlg.querySelector('[data-file]');
    dlg.querySelector('[data-restore]').onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const content = JSON.parse(await file.text());
        if (content.app !== 'Forma' || !validState(content.journal))
          throw Error('Choose a valid Forma backup.');
        confirm(
          'Restore this backup?',
          'This replaces this device’s journal with ' +
            content.journal.sessions.length +
            ' completed workouts, ' +
            content.journal.meals.length +
            ' food entries and ' +
            content.journal.weights.length +
            ' weigh-ins.',
          'Restore backup',
          async () => {
            await save(() => content.journal);
            dlg.close();
            go('workouts');
            toast('Backup restored');
          },
        );
      } catch {
        dlg.querySelector('.form-error').textContent =
          'This file is not a valid Forma backup.';
      } finally {
        input.value = '';
      }
    };
  }
  function sessionExercise() {
    const sessionId = state().active.id;
    const dlg = form(
      'Add exercise',
      selectField('Exercise', 'exerciseId', options(state().exercises, null)) +
        btn(
          'inline',
          icon('plus', 15) + 'New exercise',
          'text-btn',
          'data-new',
        ),
      'Add to workout',
      async (fd) => {
        await save((s) => {
          if (s.active?.id !== sessionId)
            throw Error('This session has changed.');
          const e = s.exercises.find((x) => x.id === fd.get('exerciseId'));
          if (!e) throw Error('Choose an exercise.');
          s.active.items.push(
            ...startSession(
              {
                id: 'empty',
                name: 'Workout',
                items: [{ ...e, exerciseId: e.id }],
              },
              s,
            ).items,
          );
        });
      },
    );
    dlg.querySelector('[data-new]').onclick = () =>
      exercise(null, (e) => {
        dlg.querySelector('[name=exerciseId]').innerHTML = options(
          state().exercises,
          e.id,
        );
      });
  }
  return {
    exercise,
    routine,
    food,
    meal,
    goals,
    weigh,
    sessionDetails,
    settings,
    sessionExercise,
  };
}
