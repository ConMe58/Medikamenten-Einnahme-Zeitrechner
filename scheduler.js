function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total) {
  total = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function addMinutes(hhmm, min) {
  return fromMinutes(toMinutes(hhmm) + min);
}

function actualFirstMorningMedication(events, fallbackTime) {
  const todayEvents = events
    .filter(e => e.takenTime)
    .sort((a, b) => toMinutes(a.takenTime) - toMinutes(b.takenTime));
  return todayEvents[0]?.takenTime || fallbackTime;
}

function latestEventForMed(events, medId) {
  return [...events]
    .filter(e => e.medId === medId && e.takenTime)
    .sort((a, b) => toMinutes(b.takenTime) - toMinutes(a.takenTime))[0] || null;
}

function toxapreventAllowedAt(candidateMin, otherPlannedMins, spacing) {
  for (const other of otherPlannedMins) {
    const diff = other - candidateMin;
    if (diff >= 0 && diff < spacing.minimumBeforeOtherMedication) return false;
    if (diff < 0 && Math.abs(diff) < spacing.minimumAfterOtherMedication) return false;
  }
  return true;
}

function scoreToxaprevent(candidateMin, otherPlannedMins, spacing) {
  let penalty = 0;
  for (const other of otherPlannedMins) {
    const diff = other - candidateMin;
    if (diff >= 0 && diff < spacing.preferredBeforeOtherMedication) penalty += spacing.preferredBeforeOtherMedication - diff;
    if (diff < 0 && Math.abs(diff) < spacing.preferredAfterOtherMedication) penalty += spacing.preferredAfterOtherMedication - Math.abs(diff);
  }
  return penalty;
}

export function buildSchedule(config, events = []) {
  const meds = config.medications;
  const firstMorning = actualFirstMorningMedication(events, config.dayAnchor.plannedFirstMedicationTime);
  const schedule = [];

  for (const med of meds) {
    if (med.type === 'relative_to_first_morning_med') {
      schedule.push({
        medId: med.id,
        name: med.name,
        earliest: addMinutes(firstMorning, med.windowAfterFirstMedicationMin.earliest),
        ideal: addMinutes(firstMorning, med.idealAfterFirstMedicationMin),
        latest: addMinutes(firstMorning, med.windowAfterFirstMedicationMin.latest),
        status: 'planned'
      });
    }

    if (med.type === 'series_after_first_morning_med') {
      let earliestMin = toMinutes(firstMorning) + med.firstDoseWindowAfterFirstMedicationMin.earliest;
      let latestMin = toMinutes(firstMorning) + med.firstDoseWindowAfterFirstMedicationMin.latest;
      const latestDayMin = toMinutes(med.latestTime);
      let index = 1;
      while (earliestMin <= latestDayMin) {
        schedule.push({
          medId: med.id,
          name: med.name,
          doseNo: index,
          earliest: fromMinutes(earliestMin),
          ideal: fromMinutes(earliestMin),
          latest: fromMinutes(Math.min(latestMin, latestDayMin)),
          status: 'planned'
        });
        earliestMin += med.repeatIntervalMin.earliest;
        latestMin += med.repeatIntervalMin.latest;
        index++;
      }
    }

    if (med.type === 'time_window') {
      schedule.push({
        medId: med.id,
        name: med.name,
        earliest: med.window.earliest,
        ideal: med.window.ideal,
        latest: med.window.latest,
        status: 'planned'
      });
    }

    if (med.type === 'repeat_after_taken' || med.type === 'repeat_after_taken_same_med_only') {
      const last = latestEventForMed(events, med.id);
      if (last) {
        const next = addMinutes(last.takenTime, med.repeatIntervalMin);
        schedule.push({
          medId: med.id,
          name: med.name,
          earliest: next,
          ideal: next,
          latest: next,
          status: 'next_after_confirmed_dose'
        });
      }
    }

    if (med.type === 'dynamic_day_slots') {
      for (const slot of med.slots) {
        schedule.push({
          medId: med.id,
          name: `${med.name} ${slot.label}`,
          amount: slot.amount,
          earliest: null,
          ideal: null,
          latest: null,
          status: 'dynamic_slot_unplaced'
        });
      }
    }
  }

  // Toxaprevent: place as close as possible to preferred spacing, but enforce hard minimums; otherwise mark skipped.
  const tox = meds.find(m => m.id === 'toxaprevent');
  if (tox) {
    const otherMins = schedule
      .filter(s => s.medId !== 'toxaprevent' && s.ideal)
      .map(s => toMinutes(s.ideal));
    let best = null;
    for (let t = toMinutes(firstMorning); t <= toMinutes('23:30'); t += 5) {
      if (!toxapreventAllowedAt(t, otherMins, tox.spacingToOtherMedsMin)) continue;
      const score = scoreToxaprevent(t, otherMins, tox.spacingToOtherMedsMin);
      if (!best || score < best.score) best = { t, score };
    }
    const existing = schedule.findIndex(s => s.medId === 'toxaprevent');
    const toxEntry = best
      ? { medId: tox.id, name: tox.name, earliest: fromMinutes(best.t), ideal: fromMinutes(best.t), latest: fromMinutes(best.t), status: best.score === 0 ? 'preferred_spacing_met' : 'minimum_spacing_met' }
      : { medId: tox.id, name: tox.name, earliest: null, ideal: null, latest: null, status: 'skipped_impossible_without_breaking_rules' };
    if (existing >= 0) schedule[existing] = toxEntry;
    else schedule.push(toxEntry);
  }

  return schedule.sort((a, b) => {
    if (!a.ideal) return 1;
    if (!b.ideal) return -1;
    return toMinutes(a.ideal) - toMinutes(b.ideal);
  });
}

export function confirmDose(events, medId, takenTime) {
  return [...events, { medId, takenTime, confirmedAt: new Date().toISOString() }];
}
