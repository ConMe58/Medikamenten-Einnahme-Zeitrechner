# Medikamenten-Scheduler Plain

Lokale GitHub-Pages-taugliche Version mit Blockansicht.

## Dateien

- `index.html`
- `styles/main.css`
- `src/app.js`
- `src/scheduler.js`
- `data/meds.json`

## Start

Auf GitHub Pages: Repo public machen, Pages auf `main` und `/root` stellen.

Lokal: kleinen Server starten, weil `meds.json` per `fetch()` geladen wird.

```bash
python3 -m http.server 8000
```

Dann öffnen:

```text
http://localhost:8000
```
