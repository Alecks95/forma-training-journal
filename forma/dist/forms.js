import {
  uid,
  startSession,
  localDay,
  displayWeight,
  kgWeight,
  macros,
  validState,
  doneSets,
  keyWorkoutRows,
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
function selectField(label, key, opts, action = '') {
  const id = 'field-' + uid();
  return (
    '<div class="field"><div class="field-caption"><label for="' +
    id +
    '">' +
    esc(label) +
    '</label>' +
    action +
    '</div><select id="' +
    id +
    '" name="' +
    key +
    '" required>' +
    opts +
    '</select></div>'
  );
}
const dateField = (val, readonly = false) =>
  '<label class="field"><span>Date</span><input name="day" type="date" required min="1900-01-01" max="' +
  localDay() +
  '" value="' +
  esc(val) +
  '" ' +
  (readonly ? 'readonly' : '') +
  '></label>';
const grid = (html) => '<div class="form-grid">' + html + '</div>';
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
const removeButton = (label, data) =>
  btn(
    'inline',
    'Remove',
    'button remove-action',
    data + ' aria-label="' + esc(label) + '"',
  );
const removeFooter = (label, data) =>
  '<div class="form-footer">' +
  removeButton(label, data) +
  btn('close', 'Cancel', 'button') +
  '</div>';
const assertName = (records, name, id) => {
  if (
    records.some(
      (r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw Error('That name is already in your library.');
};
function targets(x, prefix = '') {
  return (
    grid(
      field('Sets', prefix + 'sets', x.sets, { min: 1, max: 100, step: 1 }) +
        field('Reps', prefix + 'reps', x.reps, { min: 1, max: 999, step: 1 }),
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
function readTargets(fd, p = '') {
  return {
    sets: num(fd, p + 'sets'),
    reps: num(fd, p + 'reps'),
    rir: num(fd, p + 'rir'),
    rest: num(fd, p + 'rest'),
  };
}
function saveLibraryItem(records, record, editing) {
  const index = records.findIndex((item) => item.id === record.id);
  if (editing && index < 0) throw Error('This item has already been removed.');
  assertName(records, record.name, record.id);
  if (index < 0) records.push(record);
  else records[index] = record;
}
export function buildForms(env) {
  const { state, ctx, save, sheet, form, confirm, toast, go, draw } = env;
  function addRemoveAction(editor, kind, record) {
    if (!record) return;
    const collection = {
      exercise: 'exercises',
      food: 'foods',
      routine: 'routines',
    }[kind];
    const footer = editor.querySelector('.form-footer');
    footer.insertAdjacentHTML(
      'afterbegin',
      removeButton('Remove ' + kind, 'data-remove-saved'),
    );
    editor.querySelector('[data-remove-saved]').onclick = () => {
      let effect = 'Remove this ' + kind + ' from your library?';
      if (kind === 'exercise') {
        const count = state().routines.filter((r) =>
          r.items.some((i) => i.exerciseId === record.id),
        ).length;
        effect = count
          ? 'Remove this exercise from your library and ' +
            count +
            ' saved routine' +
            (count === 1 ? '?' : 's?')
          : effect;
        effect +=
          ' Your active and completed workouts keep their recorded sets.';
      } else if (kind === 'food') {
        effect += ' Your food diary keeps its logged portions and nutrients.';
      } else {
        effect += ' Your workout history stays available.';
      }
      confirm(
        'Remove “' + record.name + '”?',
        effect,
        'Remove ' + kind,
        async () => {
          await save((s) => {
            s[collection] = s[collection].filter(
              (item) => item.id !== record.id,
            );
            if (kind === 'exercise') {
              for (const routine of s.routines)
                routine.items = routine.items.filter(
                  (item) => item.exerciseId !== record.id,
                );
            }
          });
          editor.close();
          toast('Removed from library');
        },
      );
    };
  }
  function exercise(id, onSaved) {
    const existing = state().exercises.find((e) => e.id === id),
      x = existing || { name: '', sets: 3, reps: 8, rir: 2, rest: 90 };
    const editor = form(
      existing ? 'Edit exercise' : 'New exercise',
      field('Exercise name', 'name', x.name, { type: 'text' }) + targets(x),
      'Save exercise',
      async (fd) => {
        const record = {
          id: existing?.id || uid(),
          name: getText(fd, 'name'),
          ...readTargets(fd),
        };
        await save((s) => {
          saveLibraryItem(s.exercises, record, existing);
        });
        onSaved?.(record);
        toast('Exercise saved');
      },
    );
    addRemoveAction(editor, 'exercise', existing);
  }
  function routine(id) {
    const old = state().routines.find((r) => r.id === id),
      items = old?.items || [];
    const dlg = form(
      old ? 'Edit routine' : 'New routine',
      field('Routine name', 'name', old?.name || '', { type: 'text' }) +
        '<div class="row-between"><h3>Exercises</h3>' +
        btn('inline', 'New exercise', 'text-btn', 'data-new-exercise') +
        '</div><div class="stack" data-items></div><div class="exercise-picker">' +
        '<select class="select" aria-label="Exercise to add" data-pick>' +
        options(state().exercises, null) +
        '</select>' +
        btn('inline', icon('plus', 16) + 'Add', 'button', 'data-add') +
        '</div>',
      'Save routine',
      async (fd, d) => {
        const items = [...d.querySelectorAll('[data-row]')].map((el) => ({
          exerciseId: el.dataset.exercise,
          ...readTargets(fd, el.dataset.row + '-'),
        }));
        if (!old && !items.length)
          throw Error('Add at least one exercise to the routine.');
        const record = {
          id: old?.id || uid(),
          name: getText(fd, 'name'),
          items,
        };
        await save((s) => {
          if (
            items.some((i) => !s.exercises.some((e) => e.id === i.exerciseId))
          )
            throw Error(
              'A selected exercise was removed. Remove it from this draft before saving.',
            );
          saveLibraryItem(s.routines, record, old);
        });
        ctx.routine = record.id;
        draw();
        toast('Routine saved');
      },
    );
    addRemoveAction(dlg, 'routine', old);
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
        targets(values || e, sequence + '-');
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
    const editor = form(
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
          saveLibraryItem(s.foods, record, old);
        });
        onSaved?.(record);
        toast('Food saved');
      },
    );
    addRemoveAction(editor, 'food', old);
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
      selectField(
        'Saved food',
        'foodId',
        options(state().foods, first),
        btn(
          'inline',
          icon('plus', 15) + 'Create food',
          'text-btn',
          'data-new-food',
        ),
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
    if (old) {
      dlg
        .querySelector('.form-footer')
        .insertAdjacentHTML(
          'afterbegin',
          removeButton('Remove weigh-in', 'data-remove-saved'),
        );
      dlg.querySelector('[data-remove-saved]').onclick = () =>
        removeWeighIn(day, dlg);
    }
  }
  function removeWeighIn(day, editor) {
    confirm(
      'Delete this weigh-in?',
      'This removes the entry for ' +
        day +
        ' and recalculates its weekly average.',
      'Delete entry',
      async () => {
        await save((s) => {
          s.weights = s.weights.filter((w) => w.day !== day);
        });
        editor?.close();
        toast('Weigh-in removed');
      },
    );
  }
  async function sessionDetails(id) {
    let w = state().sessions.find((x) => x.id === id);
    if (!w) return;
    if (w.items.some((i) => !i.entryId || i.sets.some((set) => !set.entryId))) {
      await save((s) => {
        const workout = s.sessions.find((x) => x.id === id);
        if (workout) keyWorkoutRows(workout);
      }, false);
      w = state().sessions.find((x) => x.id === id);
      if (!w) return;
    }
    const s = state();
    const detail = sheet(
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
              '<div class="plan-item"><div class="row-between"><strong>' +
              esc(i.name) +
              '</strong>' +
              smallBtn(
                'manage-exercise',
                'Manage ' + i.name,
                'menu',
                'data-workout="' + w.id + '" data-entry="' + i.entryId + '"',
              ) +
              '</div><div class="history-sets">' +
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
        '</div>' +
        removeFooter('Remove workout', 'data-delete-workout'),
    );
    detail.dataset.historyId = id;
    detail.querySelector('[data-delete-workout]').onclick = () =>
      confirm(
        'Delete this workout?',
        'Delete “' +
          w.name +
          '” and its logged sets from History and exercise graphs?',
        'Delete workout',
        async () => {
          await save((s) => {
            s.sessions = s.sessions.filter((x) => x.id !== id);
          });
          detail.close();
          toast('Workout deleted');
        },
      );
  }
  function manageExercise(workoutId, entryId) {
    const active = state().active?.id === workoutId;
    const getWorkout = (s) =>
      active
        ? s.active?.id === workoutId
          ? s.active
          : null
        : s.sessions.find((w) => w.id === workoutId);
    const workout = getWorkout(state());
    const item = workout?.items.find((i) => i.entryId === entryId);
    if (!item) throw Error('This exercise is no longer in the workout.');
    const options = sheet(
      item.name,
      '<div class="list">' +
        item.sets
          .map((set, index) =>
            !active && !set.done
              ? ''
              : '<div class="row"><div><strong>Set ' +
                (index + 1) +
                '</strong><small class="set-description">' +
                (set.kg == null
                  ? '—'
                  : fmt(displayWeight(set.kg, state().unit))) +
                ' ' +
                state().unit +
                ' × ' +
                set.reps +
                ' · ' +
                set.rir +
                ' RIR</small></div>' +
                smallBtn(
                  'inline',
                  'Remove set ' + (index + 1),
                  'bin',
                  'data-remove-set="' + set.entryId + '"',
                ) +
                '</div>',
          )
          .join('') +
        '</div>' +
        removeFooter('Remove exercise from workout', 'data-remove-exercise'),
    );
    options.onclick = (event) => {
      const button = event.target.closest(
        '[data-remove-set], [data-remove-exercise]',
      );
      if (!button) return;
      const setId = button.dataset.removeSet;
      const removed = setId
        ? item.sets.filter((set) => set.entryId === setId)
        : item.sets;
      const count = removed.filter((set) => set.done).length;
      const deletesWorkout = !active && doneSets(workout).length === count;
      const subject = setId ? 'set' : 'exercise';
      const message = deletesWorkout
        ? 'This removes the last logged set from “' +
          workout.name +
          '” and deletes that workout from History.'
        : 'Remove this ' + subject + ' from “' + workout.name + '”?';
      confirm(
        'Remove ' + subject + '?',
        message,
        deletesWorkout ? 'Delete workout' : 'Remove ' + subject,
        async () => {
          await save((s) => {
            const w = getWorkout(s);
            const row = w?.items.find((i) => i.entryId === entryId);
            if (
              !row ||
              (setId && !row.sets.some((set) => set.entryId === setId))
            )
              throw Error('This entry was already removed.');
            const removedSets = setId
              ? row.sets.filter((set) => set.entryId === setId)
              : row.sets;
            row.sets = row.sets.filter((set) => !removedSets.includes(set));
            if (
              !row.sets.length ||
              (!active && !row.sets.some((set) => set.done))
            )
              w.items = w.items.filter((i) => i !== row);
            if (
              active &&
              (!w.items.length ||
                removedSets.some((set) => set.entryId === w.restSetId))
            ) {
              w.restUntil = 0;
              w.restSetId = null;
            }
            if (!active && !doneSets(w).length) {
              if (!deletesWorkout)
                throw Error(
                  'The workout changed. Reopen it to confirm deleting the last set.',
                );
              s.sessions = s.sessions.filter((x) => x.id !== workoutId);
            }
          });
          options.close();
          if (!active) {
            document
              .querySelector('dialog[data-history-id="' + workoutId + '"]')
              ?.close();
            await sessionDetails(workoutId);
          }
          toast(deletesWorkout ? 'Workout deleted' : 'Removed from workout');
        },
      );
    };
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
        '<div class="form-error" role="alert"></div></div>',
    );
    dlg.classList.add('settings-dialog');
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
          [JSON.stringify({ app: 'Form', journal: fresh }, null, 2)],
          { type: 'application/json' },
        );
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'form-backup-' + localDay() + '.json';
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
        if (
          !['Form', 'Forma'].includes(content.app) ||
          !validState(content.journal)
        )
          throw Error('Choose a valid Form backup.');
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
          'Choose a valid Form backup file.';
      } finally {
        input.value = '';
      }
    };
  }
  function sessionExercise() {
    const sessionId = state().active.id;
    const dlg = form(
      'Add exercise',
      selectField(
        'Exercise',
        'exerciseId',
        options(state().exercises, null),
        btn(
          'inline',
          icon('plus', 15) + 'New exercise',
          'text-btn',
          'data-new',
        ),
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
    removeWeighIn,
    sessionDetails,
    manageExercise,
    settings,
    sessionExercise,
  };
}
