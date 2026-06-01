import { calculatePlan, timeToMinutes } from './scheduler.js';

const state = {
  rules: null,
  events: JSON.parse(localStorage.getItem('medEvents') || '[]')
};

const blocksEl = document.querySelector('#blocks');
const eventsEl = document.querySelector('#events');
const clearBtn = document.querySelector('#clearBtn');
const manualTime = document.querySelector('#manualTime');
const prnButtons = document.querySelector('#prnButtons');
const nowLine = document.querySelector('#nowLine');
const sinceLine = document.querySelector('#sinceLine');

function save() {
  localStorage.setItem('medEvents', JSON.stringify(state.events));
}

function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

function diffMinutes(fromHHMM, toHHMM) {
  return timeToMinutes(toHHMM) - timeToMinutes(fromHHMM);
}

function formatDuration(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h} h ${m} min`;
}

function statusLabel(status) {
  if (status === 'optimal') return '✓ optimal';
  if (status === 'acceptable') return '⚠ akzeptabel';
  if (status === 'violation') return '✗ Regelverletzung';
  if (status === 'skipped') return '⚠ ausgelassen';
  if (status === 'available_from') return 'ab dann möglich';
  return 'geplant';
}

function blockNameFor(items) {
  const names = items.map(i => i.med);
  if (names.includes('Mestinon')) return 'Mestinon / Zeitblock';
  if (names.includes('Venlafaxin')) return 'Venlafaxin';
  if (names.includes('Aripiprazol')) return 'Aripiprazol';
  const minute = timeToMinutes(items[0].time);
  if (minute < 10 * 60) return 'Morgenblock';
  if (minute < 15 * 60) return 'Mittagsblock';
  if (minute < 20 * 60) return 'Abendblock';
  return 'Nachtblock';
}

function groupPlan(plan) {
  const map = new Map();
  for (const item of plan.filter(x => x.time)) {
    if (!map.has(item.time)) map.set(item.time, []);
    map.get(item.time).push(item);
  }
  return [...map.entries()]
    .map(([time, items]) => ({ time, items }))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function latestEvent() {
  return state.events.slice().sort((a, b) => a.time.localeCompare(b.time)).at(-1) || null;
}

function renderTopClock() {
  const now = nowHHMM();
  nowLine.textContent = now;
  const last = latestEvent();
  if (!last) {
    sinceLine.textContent = 'Seit letzter dokumentierter Einnahme: —';
    return;
  }
  const delta = diffMinutes(last.time, now);
  sinceLine.textContent = `Seit letzter dokumentierter Einnahme: ${formatDuration(delta)} (${last.time}, ${last.med})`;
}

function renderBlocks() {
  const plan = calculatePlan(state.events, state.rules);
  const skipped = plan.filter(item => !item.time);
  const grouped = groupPlan(plan).slice(0, 6);
  const now = nowHHMM();

  if (!grouped.length && !skipped.length) {
    blocksEl.innerHTML = '<p>Keine offenen Vorschläge.</p>';
    return;
  }

  const blocksHtml = grouped.map((block, blockIndex) => {
    const delta = diffMinutes(now, block.time);
    const countdown = delta >= 0
      ? `in ${formatDuration(delta)}`
      : `seit ${formatDuration(-delta)} fällig`;
    const sincePrevious = blockIndex === 0
      ? (latestEvent() ? `Seit letzter Einnahme: ${formatDuration(diffMinutes(latestEvent().time, now))}` : 'Noch keine Einnahme dokumentiert')
      : `Seit vorherigem Block: ${formatDuration(diffMinutes(grouped[blockIndex - 1].time, block.time))}`;

    return `
      <div class="block status-${block.items[0].status}">
        <div class="block-header">
          <div>
            <div class="block-time">${block.time}</div>
            <div class="block-title">${blockNameFor(block.items)}</div>
          </div>
          <div class="countdown">
            <strong>${countdown}</strong>
            <span>${sincePrevious}</span>
          </div>
        </div>

        <div class="med-list">
          ${block.items.map((item, itemIndex) => `
            <label class="med-item">
              <input type="checkbox" checked data-block="${blockIndex}" data-index="${itemIndex}">
              <span>
                <span class="med-main">${item.med}${item.dose ? ` Dosis ${item.dose}` : ''}${item.doseLabel ? ` (${item.doseLabel})` : ''}</span>
                <span class="med-sub">${statusLabel(item.status)}${item.window ? ` · Fenster ${item.window}` : ''}${item.reason ? ` · ${item.reason}` : ''}</span>
              </span>
            </label>
          `).join('')}
        </div>

        <button data-confirm-block="${blockIndex}">Ausgewählte um ${block.time} dokumentieren</button>
      </div>
    `;
  }).join('');

  const skippedHtml = skipped.map(item => `
    <div class="block status-skipped">
      <div class="block-title">${item.med}</div>
      <div class="muted">${statusLabel(item.status)} · ${item.reason || ''}</div>
    </div>
  `).join('');

  blocksEl.innerHTML = blocksHtml + skippedHtml;
  blocksEl._grouped = grouped;
}

function renderEvents() {
  if (!state.events.length) {
    eventsEl.innerHTML = '<p>Noch keine Einnahmen dokumentiert.</p>';
    return;
  }
  eventsEl.innerHTML = state.events
    .map((e, originalIndex) => ({ ...e, originalIndex }))
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(e => `
      <div class="row">
        <div><strong>${e.time}</strong> ${e.med}${e.doseLabel ? ` (${e.doseLabel})` : ''}${e.dose ? ` Dosis ${e.dose}` : ''}</div>
        <button data-delete="${e.originalIndex}">löschen</button>
      </div>
    `).join('');
}

function renderPrnButtons() {
  const meds = [
    ...(state.rules.asNeededMeds || []),
    ...(state.rules.optionalMeds || [])
  ];
  prnButtons.innerHTML = meds.map(med => `<button data-prn="${med.name}">${med.name}</button>`).join('');
}

function render() {
  renderTopClock();
  renderBlocks();
  renderEvents();
}

blocksEl.addEventListener('click', event => {
  const blockIndex = event.target?.dataset?.confirmBlock;
  if (blockIndex === undefined) return;
  const grouped = blocksEl._grouped || [];
  const block = grouped[Number(blockIndex)];
  if (!block) return;

  const checked = [...blocksEl.querySelectorAll(`input[data-block="${blockIndex}"]:checked`)];
  for (const cb of checked) {
    const item = block.items[Number(cb.dataset.index)];
    state.events.push({
      med: item.med,
      dose: item.dose || null,
      doseLabel: item.doseLabel || null,
      time: block.time,
      createdAt: new Date().toISOString()
    });
  }
  save();
  render();
});

eventsEl.addEventListener('click', event => {
  const index = event.target?.dataset?.delete;
  if (index === undefined) return;
  state.events.splice(Number(index), 1);
  save();
  render();
});

prnButtons.addEventListener('click', event => {
  const med = event.target?.dataset?.prn;
  if (!med) return;
  state.events.push({ med, time: manualTime.value || nowHHMM(), createdAt: new Date().toISOString() });
  save();
  render();
});

clearBtn.addEventListener('click', () => {
  state.events = [];
  save();
  render();
});

async function init() {
  const response = await fetch('./data/meds.json');
  state.rules = await response.json();
  manualTime.value = nowHHMM();
  renderPrnButtons();
  render();
  setInterval(renderTopClock, 30000);
}

init();
