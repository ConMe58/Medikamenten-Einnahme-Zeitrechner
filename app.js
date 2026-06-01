import { calculatePlan } from './scheduler.js';

const state = {
  rules: null,
  events: JSON.parse(localStorage.getItem('medEvents') || '[]')
};

const medSelect = document.querySelector('#medSelect');
const timeInput = document.querySelector('#timeInput');
const eventsEl = document.querySelector('#events');
const planEl = document.querySelector('#plan');
const clearBtn = document.querySelector('#clearBtn');
const addBtn = document.querySelector('#addBtn');

function save() {
  localStorage.setItem('medEvents', JSON.stringify(state.events));
}

function allMedicationNames() {
  const names = [
    ...state.rules.fixedMeds.map(m => m.name),
    ...state.rules.asNeededMeds.map(m => m.name),
    ...state.rules.optionalMeds.map(m => m.name)
  ];
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'de'));
}

function renderSelect() {
  medSelect.innerHTML = allMedicationNames().map(name => `<option>${name}</option>`).join('');
}

function statusLabel(status) {
  if (status === 'optimal') return '✓ optimal';
  if (status === 'acceptable') return '⚠ akzeptabel';
  if (status === 'violation') return '✗ Regelverletzung';
  if (status === 'skipped') return '⚠ ausgelassen';
  if (status === 'available_from') return 'ab dann möglich';
  return 'geplant';
}

function renderEvents() {
  if (!state.events.length) {
    eventsEl.innerHTML = '<p>Noch keine Einnahmen dokumentiert.</p>';
    return;
  }
  eventsEl.innerHTML = state.events
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((e, index) => `
      <div class="row">
        <strong>${e.time}</strong> ${e.med}
        <button data-delete="${index}">löschen</button>
      </div>
    `).join('');
}

function renderPlan() {
  const plan = calculatePlan(state.events, state.rules);
  if (!plan.length) {
    planEl.innerHTML = '<p>Keine offenen Vorschläge.</p>';
    return;
  }
  planEl.innerHTML = plan.map(item => `
    <div class="card ${item.status}">
      <div><strong>${item.time || '—'}</strong> ${item.med}${item.dose ? ` Dosis ${item.dose}` : ''}${item.doseLabel ? ` (${item.doseLabel})` : ''}</div>
      <div>${statusLabel(item.status)}</div>
      ${item.window ? `<div>Fenster: ${item.window}</div>` : ''}
      <small>${item.reason || ''}</small>
    </div>
  `).join('');
}

function render() {
  renderEvents();
  renderPlan();
}

addBtn.addEventListener('click', () => {
  const med = medSelect.value;
  const time = timeInput.value;
  if (!med || !time) return;
  state.events.push({ med, time, createdAt: new Date().toISOString() });
  save();
  render();
});

clearBtn.addEventListener('click', () => {
  state.events = [];
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

async function init() {
  const response = await fetch('./data/meds.json');
  state.rules = await response.json();
  timeInput.value = new Date().toTimeString().slice(0, 5);
  renderSelect();
  render();
}

init();
