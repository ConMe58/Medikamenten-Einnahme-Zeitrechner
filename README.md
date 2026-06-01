# Medikamenten-Scheduler

Lokale, statische Web-App zum dynamischen Berechnen von Medikamenten-Zeitfenstern nach bestätigten Einnahmen.

## Start

```bash
python3 -m http.server 8080
```

Dann im Browser öffnen:

```text
http://localhost:8080
```

## Struktur

- `data/meds.json`: Medikamente und Regeln
- `src/scheduler.js`: reine Berechnungslogik
- `index.html`: Oberfläche

## Grundsatz

Keine Regeln raten. Unklare Medikamente bleiben aus `meds.json` heraus, bis Dosis, Zeitfenster und Abstände bestätigt sind.

## Bereits eingetragen

- Venlafaxin: 30–45 min nach erster Medikamenteneinnahme morgens
- Mestinon: erste Dosis 30–45 min nach erster Medikamenteneinnahme, danach frühestens 4:10 h, spätestens 4:30 h, letzte Dosis spätestens 18:30
- Toxaprevent: bevorzugt 2 h nach und 1,5 h vor anderen Medikamenten; mindestens 90 min nach und 60 min vor anderen Medikamenten; wenn unmöglich, Dosis auslassen
- Aripiprazol: 13:00–15:00, ideal 14:30
- Novaminsulfon: alle 6 h ab tatsächlicher Einnahme
- Tavor Expedit: 6 h Abstand nur zwischen Tavor-Dosen
- Allergoval: dynamische Tages-Slots, nicht starre Uhrzeiten
