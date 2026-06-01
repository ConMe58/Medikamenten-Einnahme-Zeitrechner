# Medikamenten-Scheduler

Lokale Web-App / PWA zur dynamischen Berechnung eines Tagesplans nach bestätigten Medikamenteneinnahmen.

Die App trifft keine medizinischen Entscheidungen. Sie setzt ausschließlich die hier dokumentierten Regeln um. Unklare Regeln dürfen nicht geraten werden.

## Grundprinzip

Der Benutzer bestätigt jede Einnahme mit Medikament und Uhrzeit.

Beispiele:

```text
Mestinon um 08:00 genommen
Vericiguat um 08:15 genommen
```

Nach jeder Bestätigung wird der restliche Tagesplan neu berechnet.

## Tagesstart

Der Tagesstart ist die erste dokumentierte Medikamenteneinnahme des Tages.

Standardannahme bei leerem Tag: 08:00.

Wenn die erste Einnahme früher oder später erfolgt, richtet sich der Tag danach aus.

## Zeitanker

Die App versucht, möglichst nahe an diesen Referenzzeiten zu bleiben:

| Block | Zielzeit |
|---|---:|
| Morgen | 08:00 |
| Mittag | 12:00 |
| Abend | 18:30 |
| Nacht | 22:30 |

Verspätete Einnahmen sollen den Plan nicht unnötig nach hinten schieben. Der Scheduler soll wieder möglichst nah an die Referenzzeiten zurückführen.

## Feste Medikamente

Diese Medikamente sind grundsätzlich feste Tagesmedikamente:

- Vericiguat
- Ubiquinol Q10
- Desloratadin
- Magnesium
- Allergoval
- Pantoprazol
- Nebivolol
- Melatonin
- Venlafaxin
- Famotidin
- Montelukast
- Mestinon
- Aripiprazol
- Kalinor Brause

## Bedarfsmedikamente

Diese Medikamente werden nur berechnet, wenn sie eingenommen wurden:

- Tavor Expedit
- Novaminsulfon

## Optionales Medikament

- Toxaprevent

Toxaprevent wird nur eingeplant, wenn die Mindestabstände eingehalten werden können. Wenn nicht, wird die Toxaprevent-Dosis ausgelassen.

## Harte Regeln

### Mestinon

Mestinon hat Vorrang.

- 3 Dosen pro Tag
- Abstand zwischen Dosis 1 und 2: frühestens 4 h 10 min, spätestens 4 h 30 min
- Abstand zwischen Dosis 2 und 3: frühestens 4 h 10 min, spätestens 4 h 30 min
- letzte Dosis spätestens 18:30
- wenn Dosis 3 nach 18:30 landet: Warnung ausgeben, Plan trotzdem fortführen

### Venlafaxin

- 30 bis 45 Minuten nach der ersten dokumentierten Medikamenteneinnahme des Tages
- erste Einnahme kann jedes Medikament sein

Beispiel:

```text
erste Einnahme 08:00
Venlafaxin: 08:30 bis 08:45
```

### Aripiprazol

- Zielzeit: 14:30
- erlaubtes Fenster: 13:00 bis 15:00
- möglichst exakt 14:30
- bei Konflikten innerhalb des Fensters verschiebbar
- außerhalb des Fensters nicht zulässig

### Toxaprevent

Mindestabstände:

- mindestens 90 Minuten nach anderen Medikamenten
- mindestens 60 Minuten vor anderen Medikamenten

Bevorzugte Abstände:

- 120 Minuten nach anderen Medikamenten
- 90 Minuten vor anderen Medikamenten

Wenn Toxaprevent nicht ohne Verletzung der Mindestabstände integrierbar ist, wird Toxaprevent ausgelassen. Andere Medikamente werden nicht wegen Toxaprevent verschoben.

### Tavor Expedit

Bedarfsmedikament.

- nächste Einnahme frühestens 6 Stunden nach letzter Tavor-Einnahme
- kein Abstand zu anderen Medikamenten definiert

### Novaminsulfon

Bedarfsmedikament.

- nächste Einnahme frühestens 6 Stunden nach letzter Novaminsulfon-Einnahme
- kein Abstand zu anderen Medikamenten definiert

## Prioritäten

1. Mestinon-Regeln
2. Toxaprevent-Mindestabstände
3. Aripiprazol-Zeitfenster
4. Venlafaxin-Fenster
5. Morgen-/Mittag-/Abend-/Nacht-Ankerzeiten
6. Toxaprevent-Präferenzabstände
7. möglichst wenige getrennte Einnahmezeitpunkte

## Statusanzeige

Jeder Vorschlag soll einen Status erhalten:

```text
✓ optimal
⚠ akzeptabel
✗ Regelverletzung
```

Beispiele:

```text
Aripiprazol 14:42
⚠ 12 Minuten von Zielzeit entfernt
```

```text
Toxaprevent
⚠ ausgelassen, kein gültiges Zeitfenster
```

```text
Mestinon Dosis 3
✗ nach 18:30
```

## Technische Anforderungen

- lokale Web-App
- offline nutzbar
- keine Cloud
- keine Benutzerkonten
- Speicherung in LocalStorage
- Regelwerk als JSON konfigurierbar
- vollständige Neuberechnung nach jeder bestätigten Einnahme
- keine geratenen Medikamentenregeln

## Projektstruktur

```text
med-scheduler-github/
  index.html
  README.md
  data/
    meds.json
  src/
    scheduler.js
    app.js
  styles/
    main.css
```

## Start lokal

Einfach `index.html` im Browser öffnen.

Für GitHub Pages: Repository veröffentlichen und Pages auf Branch `main`, Root-Verzeichnis aktivieren.
