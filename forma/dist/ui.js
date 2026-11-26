const paths = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  workouts:
    '<path d="m6 7 11 11M3 9l6-6m6 18 6-6M2.5 6.5l4-4m11 19 4-4M5 12l7-7m0 14 7-7"/>',
  nutrition:
    '<path d="M6 3v6m3-6v6m3-6v6c0 2-1.3 3-3 3s-3-1-3-3m3 3v9M19 3c-3 3-4 7-4 10h4m0-10v18"/>',
  weight:
    '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M7 9a8 8 0 0 1 10 0l-3 4h-4Zm5 3 2-4"/>',
  exercises: '<path d="M3 19h18M4 14l5-5 4 3 7-8"/>',
  settings:
    '<path d="M4 7h7m5 0h4M4 17h3m5 0h8"/><circle cx="13.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="m7 4 13 8-13 8Z" fill="currentColor" stroke-linejoin="round"/>',
  activity: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
  layers:
    '<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5m-18 9 9 5 9-5" transform="translate(0 -1) scale(1 .9)"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  flame:
    '<path d="M13 2c1 5-2 7-4 9-1-1-2-2-2-4-3 4-4 7-2 11a8 8 0 0 0 14-1c1-4-1-7-3-9 0 3-1 4-2 5 1-5 1-7-1-11Z"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  bin: '<path d="M4 6h16M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  leaf: '<path d="M20 3C10 2 4 6 4 13a7 7 0 0 0 7 7c7 0 10-9 9-17ZM5 20l10-11"/>',
  timer:
    '<circle cx="12" cy="14" r="7.5"/><path d="M12 10v4l3 1M9 2h6m-3 0v4m6 2 2-2"/>',
  book: '<path d="M4 4h6c1 0 2 1 2 2 0-1 1-2 2-2h6v15h-6c-1 0-2 1-2 2 0-1-1-2-2-2H4Z"/>',
  scale: '<path d="M4 17h3v4H4Zm6-6h3v10h-3Zm6-7h3v17h-3Z"/>',
  menu: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  history: '<path d="M3 5v5h5M3 10a9 9 0 1 1 1 8m8-12v6l4 2"/>',
};
export const icon = (key, size = 20) =>
  '<svg aria-hidden="true" focusable="false" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
  (paths[key] || '') +
  '</svg>';
export const esc = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export const fmt = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
export const clockText = (s) =>
  Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
export const dateText = (day, opts = { month: 'short', day: 'numeric' }) =>
  new Date(day + 'T12:00:00').toLocaleDateString('en-US', opts);
export const btn = (action, label, cls = 'button', data = '') =>
  '<button type="button" class="' +
  cls +
  '" data-do="' +
  action +
  '" ' +
  data +
  '>' +
  label +
  '</button>';
export const smallBtn = (action, label, glyph, data = '') =>
  btn(
    action,
    icon(glyph, 17),
    'icon-button',
    data + ' aria-label="' + esc(label) + '" title="' + esc(label) + '"',
  );
export const pill = (text, kind = '') =>
  '<span class="pill ' + kind + '">' + text + '</span>';
export const head = (title, action = '') =>
  '<div class="page-head"><h1>' + esc(title) + '</h1>' + action + '</div>';
export const sect = (title, action = '') =>
  '<div class="section-head"><h2>' + title + '</h2>' + action + '</div>';
export const labelIcon = (key, label) =>
  '<span class="icon-label">' + icon(key, 17) + label + '</span>';
export function field(label, key, value, props = {}) {
  const {
    type = 'number',
    min = 0,
    max,
    step = 'any',
    required = true,
  } = props;
  return (
    '<label class="field"><span>' +
    esc(label) +
    '</span><input name="' +
    esc(key) +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    (required ? 'required ' : '') +
    (type === 'number'
      ? 'inputmode="' +
        (step === 1 ? 'numeric' : 'decimal') +
        '" min="' +
        min +
        '" ' +
        (max !== undefined ? 'max="' + max + '" ' : '') +
        'step="' +
        step +
        '"'
      : type === 'text'
        ? 'maxlength="100"'
        : '') +
    '></label>'
  );
}
export function plot(points, unit, { short = false } = {}) {
  if (!points.length)
    return (
      '<div class="empty-chart ' +
      (short ? 'short' : '') +
      '"><span>' +
      icon('exercises', 29) +
      '</span><small>Awaiting first entry</small></div>'
    );
  const width = 520,
    height = short ? 105 : 190,
    left = 47,
    right = 16,
    top = 16,
    bottom = 26;
  const values = points.map((p) => p.value),
    lo = Math.min(...values),
    hi = Math.max(...values);
  const spread = hi - lo || Math.max(Math.abs(hi) * 0.05, 1),
    min = Math.max(0, lo - spread * 0.18),
    max = hi + spread * 0.18;
  const times = points.map((p) => new Date(p.day + 'T12:00:00').getTime()),
    end = times.at(-1) - times[0];
  const x = (i) =>
    left + (end ? (times[i] - times[0]) / end : 0.5) * (width - left - right);
  const y = (v) => top + ((max - v) / (max - min)) * (height - top - bottom);
  const line = points
    .map((p, i) => x(i).toFixed(2) + ',' + y(p.value).toFixed(2))
    .join(' ');
  const grids = [max, (max + min) / 2, min]
    .map(
      (v) =>
        '<line x1="' +
        left +
        '" x2="' +
        (width - right) +
        '" y1="' +
        y(v) +
        '" y2="' +
        y(v) +
        '"/><text x="' +
        (left - 8) +
        '" y="' +
        (y(v) + 4) +
        '" text-anchor="end">' +
        fmt(v) +
        '</text>',
    )
    .join('');
  const dots = points
    .map(
      (p, i) =>
        '<circle cx="' +
        x(i) +
        '" cy="' +
        y(p.value) +
        '" r="' +
        (points.length > 35 ? 1.5 : 3.5) +
        '"><title>' +
        dateText(p.day) +
        ': ' +
        fmt(p.value) +
        ' ' +
        esc(unit) +
        '</title></circle>',
    )
    .join('');
  return (
    '<svg class="chart" role="img" aria-label="' +
    esc(
      unit +
        ' trend, ' +
        points.length +
        ' entries, latest ' +
        fmt(values.at(-1)) +
        ' ' +
        unit,
    ) +
    '" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '">' +
    grids +
    '<polygon points="' +
    x(0) +
    ',' +
    (height - bottom) +
    ' ' +
    line +
    ' ' +
    x(points.length - 1) +
    ',' +
    (height - bottom) +
    '"/><polyline points="' +
    line +
    '"/>' +
    dots +
    '<text x="' +
    left +
    '" y="' +
    (height - 4) +
    '">' +
    dateText(points[0].day) +
    '</text>' +
    (points.length > 1
      ? '<text x="' +
        (width - right) +
        '" y="' +
        (height - 4) +
        '" text-anchor="end">' +
        dateText(points.at(-1).day) +
        '</text>'
      : '') +
    '</svg>'
  );
}
