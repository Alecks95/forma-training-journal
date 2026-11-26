export const LB = 2.20462262185;
export const uid = () => crypto.randomUUID();
export const localDay = (d = new Date()) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
export const dateAt = (day) => new Date(day + 'T12:00:00');
export function shiftDay(day, amount) {
  const d = dateAt(day);
  d.setDate(d.getDate() + amount);
  return localDay(d);
}
export function monday(day) {
  return shiftDay(day, -(dateAt(day).getDay() + 6) % 7);
}
export const displayWeight = (kg, unit) =>
  Math.round(kg * (unit === 'lb' ? LB : 1) * 100) / 100;
export const kgWeight = (value, unit) =>
  Number(value) / (unit === 'lb' ? LB : 1);
export const macros = ['kcal', 'protein', 'carbs', 'fat'];

export function initialState() {
  const exercises = [
    ['goblet-squat', 'Goblet squat', 10, 90],
    ['dumbbell-press', 'Dumbbell bench press', 8, 90],
    ['cable-row', 'Seated cable row', 10, 60],
  ].map(([id, name, reps, rest]) => ({
    id,
    name,
    sets: 3,
    reps,
    kg: 0,
    rir: 2,
    rest,
  }));
  return {
    version: 1,
    unit: 'kg',
    goals: { kcal: 2000, protein: 120, carbs: 250, fat: 60 },
    exercises,
    routines: [
      {
        id: 'full-body',
        name: 'Full Body A',
        items: exercises.map(({ id, name, ...targets }) => ({
          exerciseId: id,
          ...targets,
        })),
      },
    ],
    sessions: [],
    active: null,
    foods: [],
    meals: [],
    weights: [],
  };
}

export function startSession(routine, state) {
  return {
    id: uid(),
    name: routine.name,
    routineId: routine.id,
    day: localDay(),
    started: Date.now(),
    restUntil: 0,
    items: routine.items.map((item) => ({
      exerciseId: item.exerciseId,
      name: state.exercises.find((e) => e.id === item.exerciseId).name,
      rest: item.rest,
      sets: Array.from({ length: item.sets }, () => ({
        reps: item.reps,
        kg: item.kg,
        rir: item.rir,
        done: false,
      })),
    })),
  };
}
export const doneSets = (session) =>
  session.items.flatMap((e) => e.sets.filter((s) => s.done));
export function keyWorkoutRows(workout) {
  let changed = false;
  for (const item of workout.items) {
    for (const row of [item, ...item.sets]) {
      if (!row.entryId) {
        row.entryId = uid();
        changed = true;
      }
    }
  }
  return changed;
}
export function weeklyWeights(weights) {
  const weeks = new Map();
  for (const w of weights) {
    const key = monday(w.day);
    const bucket = weeks.get(key) || { day: key, sum: 0, count: 0 };
    bucket.sum += w.kg;
    bucket.count++;
    weeks.set(key, bucket);
  }
  return [...weeks.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((w) => ({ ...w, value: w.sum / w.count }));
}
export function progression(sessions, exerciseId) {
  const sets = [];
  const chronological = [...sessions].sort(
    (a, b) =>
      a.day.localeCompare(b.day) || a.started - b.started || a.ended - b.ended,
  );
  for (const session of chronological) {
    for (const item of session.items) {
      if (item.exerciseId !== exerciseId) continue;
      item.sets.forEach((set, index) => {
        if (set.done)
          sets.push({
            day: session.day,
            workout: session.name,
            setNumber: index + 1,
            kg: set.kg,
            reps: set.reps,
          });
      });
    }
  }
  return sets;
}
export function dailyNutrition(meals, day) {
  return meals
    .filter((m) => m.day === day)
    .reduce(
      (totals, m) => {
        macros.forEach((k) => (totals[k] += m[k] * m.servings));
        return totals;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

const numeric = (x, min = 0, max = 1e8) =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const integer = (x, min, max) => Number.isInteger(x) && numeric(x, min, max);
const nameOk = (x) =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= 100;
const idOk = (x) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
const dayOk = (x) =>
  typeof x === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  localDay(dateAt(x)) === x;
const targetOk = (x) =>
  integer(x.reps, 1, 999) && numeric(x.kg, 0, 100000) && integer(x.rir, 0, 20);
const planOk = (x) =>
  targetOk(x) && integer(x.sets, 1, 100) && integer(x.rest, 0, 3600);
const nutritionOk = (x) => macros.every((k) => numeric(x[k], 0, 1000000));
const unique = (a, key) => new Set(a.map((x) => x[key])).size === a.length;
export function validState(s) {
  try {
    if (
      s.version !== 1 ||
      !['kg', 'lb'].includes(s.unit) ||
      !nutritionOk(s.goals) ||
      !macros.every((k) => s.goals[k] > 0)
    )
      return false;
    for (const key of [
      'exercises',
      'routines',
      'sessions',
      'foods',
      'meals',
      'weights',
    ])
      if (!Array.isArray(s[key])) return false;
    for (const key of ['exercises', 'routines', 'sessions', 'foods', 'meals'])
      if (
        !s[key].every((x) => idOk(x.id) && nameOk(x.name)) ||
        !unique(s[key], 'id')
      )
        return false;
    const hasExercise = (id) => s.exercises.some((e) => e.id === id);
    const sessionOk = (x) =>
      idOk(x.id) &&
      nameOk(x.name) &&
      idOk(x.routineId) &&
      dayOk(x.day) &&
      numeric(x.started, 1, 1e14) &&
      numeric(x.restUntil, 0, 1e14) &&
      Array.isArray(x.items) &&
      unique(
        x.items.filter((item) => item.entryId !== undefined),
        'entryId',
      ) &&
      x.items.every(
        (i) =>
          idOk(i.exerciseId) &&
          (i.entryId === undefined || idOk(i.entryId)) &&
          nameOk(i.name) &&
          integer(i.rest, 0, 3600) &&
          Array.isArray(i.sets) &&
          i.sets.length > 0 &&
          unique(
            i.sets.filter((set) => set.entryId !== undefined),
            'entryId',
          ) &&
          i.sets.every(
            (set) =>
              targetOk(set) &&
              typeof set.done === 'boolean' &&
              (set.entryId === undefined || idOk(set.entryId)),
          ),
      );
    return (
      s.exercises.every(planOk) &&
      s.routines.every(
        (r) =>
          Array.isArray(r.items) &&
          r.items.every((i) => hasExercise(i.exerciseId) && planOk(i)),
      ) &&
      s.foods.every((f) => nameOk(f.portion) && nutritionOk(f)) &&
      s.meals.every(
        (m) =>
          idOk(m.foodId) &&
          nameOk(m.portion) &&
          dayOk(m.day) &&
          numeric(m.servings, 0.01, 1000) &&
          nutritionOk(m),
      ) &&
      unique(s.weights, 'day') &&
      s.weights.every((w) => dayOk(w.day) && numeric(w.kg, 0.01, 2000)) &&
      s.sessions.every(
        (x) =>
          sessionOk(x) &&
          doneSets(x).length > 0 &&
          numeric(x.ended, x.started, 1e14),
      ) &&
      (s.active === null || sessionOk(s.active))
    );
  } catch {
    return false;
  }
}

let database;
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('forma-journal', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('journal');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      database = req.result;
      resolve();
    };
  });
}
// Read the current journal inside the write transaction so other open tabs cannot overwrite newer entries.
export function updateJournal(change) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('journal', 'readwrite');
    const store = tx.objectStore('journal'),
      req = store.get('state');
    let result, problem;
    req.onsuccess = () => {
      try {
        result = req.result || initialState();
        const replacement = change?.(result);
        if (replacement) result = replacement;
        // Older sessions identify rows by position. Give each occurrence a stable
        // identity before displaying it, including duplicate exercises in a workout.
        const keyed = result.active && keyWorkoutRows(result.active);
        if (change || !req.result || keyed) store.put(result, 'state');
      } catch (e) {
        problem = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(problem || tx.error || new Error('Storage is unavailable.'));
  });
}
