function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60).toString().padStart(2, '0');
  const m = (normalized % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function sortByTime(items) {
  return [...items].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function getFirstDoseTime(events, rules) {
  if (!events.length) return rules.defaultDayStart;
  return sortByTime(events)[0].time;
}

function latestEventFor(events, medName) {
  return sortByTime(events.filter(e => e.med === medName)).at(-1) || null;
}

function planMestinon(events, rules) {
  const rule = rules.fixedMeds.find(m => m.name === 'Mestinon');
  const taken = sortByTime(events.filter(e => e.med === 'Mestinon'));
  const result = [];

  if (!rule) return result;

  if (taken.length === 0) {
    const first = getFirstDoseTime(events, rules);
    result.push({ med: 'Mestinon', dose: 1, time: first, status: 'planned', reason: 'erste Dosis am Tagesstart orientiert' });
  }

  const base = taken.length ? taken : result.map(x => ({ med: 'Mestinon', time: x.time }));
  let lastTime = base[base.length - 1]?.time;
  let doseNo = taken.length || 1;

  while (doseNo < rule.dosesPerDay && lastTime) {
    const earliest = timeToMinutes(lastTime) + rule.minGapMinutes;
    const latest = timeToMinutes(lastTime) + rule.maxGapMinutes;
    const proposed = earliest;
    const latestAllowed = timeToMinutes(rule.lastDoseLatest);
    const warnLate = doseNo + 1 === rule.dosesPerDay && proposed > latestAllowed;

    result.push({
      med: 'Mestinon',
      dose: doseNo + 1,
      time: minutesToTime(proposed),
      window: `${minutesToTime(earliest)}–${minutesToTime(latest)}`,
      status: warnLate ? 'violation' : 'planned',
      reason: warnLate ? 'nach 18:30; Warnung, Plan wird fortgeführt' : '4:10–4:30 nach vorheriger Mestinon-Dosis'
    });

    lastTime = minutesToTime(proposed);
    doseNo += 1;
  }

  return result;
}

function planVenlafaxin(events, rules) {
  const rule = rules.fixedMeds.find(m => m.name === 'Venlafaxin');
  if (!rule) return [];
  if (events.some(e => e.med === 'Venlafaxin')) return [];

  const first = getFirstDoseTime(events, rules);
  return [{
    med: 'Venlafaxin',
    time: addMinutes(first, rule.earliestAfterFirstMinutes),
    window: `${addMinutes(first, rule.earliestAfterFirstMinutes)}–${addMinutes(first, rule.latestAfterFirstMinutes)}`,
    status: 'planned',
    reason: '30–45 Minuten nach erster dokumentierter Einnahme'
  }];
}

function planAripiprazol(events, rules) {
  const rule = rules.fixedMeds.find(m => m.name === 'Aripiprazol');
  if (!rule || events.some(e => e.med === 'Aripiprazol')) return [];
  return [{
    med: 'Aripiprazol',
    time: rule.target,
    window: `${rule.earliest}–${rule.latest}`,
    status: 'optimal',
    reason: 'Ziel 14:30 innerhalb 13:00–15:00'
  }];
}

function planAnchorMeds(events, rules) {
  const result = [];
  const special = new Set(['Mestinon', 'Venlafaxin', 'Aripiprazol']);

  for (const med of rules.fixedMeds) {
    if (special.has(med.name)) continue;
    const alreadyTaken = events.some(e => e.med === med.name && (!med.doseLabel || e.doseLabel === med.doseLabel));
    if (alreadyTaken) continue;
    const anchor = rules.anchors[med.block];
    if (!anchor) continue;
    result.push({
      med: med.name,
      doseLabel: med.doseLabel || null,
      time: anchor,
      status: 'planned',
      reason: `Ankerzeit ${med.block}`
    });
  }

  return result;
}

function planAsNeeded(events, rules) {
  const result = [];
  for (const med of rules.asNeededMeds || []) {
    const latest = latestEventFor(events, med.name);
    if (!latest) continue;
    result.push({
      med: med.name,
      time: addMinutes(latest.time, med.minGapMinutes),
      status: 'available_from',
      reason: `frühestens ${med.minGapMinutes / 60} Stunden nach letzter Einnahme`
    });
  }
  return result;
}

function planToxaprevent(events, rules, currentPlan) {
  const rule = (rules.optionalMeds || []).find(m => m.name === 'Toxaprevent');
  if (!rule) return [];

  const alreadyTaken = events.some(e => e.med === 'Toxaprevent');
  if (alreadyTaken) return [];

  const occupied = sortByTime([...events.map(e => ({ med: e.med, time: e.time })), ...currentPlan]);
  const candidates = [];

  for (let minute = 6 * 60; minute <= 23 * 60; minute += 5) {
    const ok = occupied.every(item => {
      const delta = minute - timeToMinutes(item.time);
      return delta >= rule.minAfterOtherMedsMinutes || delta <= -rule.minBeforeOtherMedsMinutes;
    });
    if (ok) candidates.push(minute);
  }

  if (!candidates.length) {
    return [{ med: 'Toxaprevent', time: null, status: 'skipped', reason: 'kein gültiges Zeitfenster; Toxaprevent ausgelassen' }];
  }

  const preferred = candidates.find(minute => occupied.every(item => {
    const delta = minute - timeToMinutes(item.time);
    return delta >= rule.preferredAfterOtherMedsMinutes || delta <= -rule.preferredBeforeOtherMedsMinutes;
  }));

  const chosen = preferred ?? candidates[0];
  return [{
    med: 'Toxaprevent',
    time: minutesToTime(chosen),
    status: preferred ? 'optimal' : 'acceptable',
    reason: preferred ? 'bevorzugte Abstände eingehalten' : 'nur Mindestabstände eingehalten'
  }];
}

export function calculatePlan(events, rules) {
  const base = [
    ...planAnchorMeds(events, rules),
    ...planVenlafaxin(events, rules),
    ...planAripiprazol(events, rules),
    ...planMestinon(events, rules),
    ...planAsNeeded(events, rules)
  ];

  const tox = planToxaprevent(events, rules, base);
  return sortByTime([...base, ...tox].filter(item => item.time)).concat(tox.filter(item => !item.time));
}

export { timeToMinutes, minutesToTime, addMinutes };
