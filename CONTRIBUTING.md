# Contributing to STL-Storage Hub

Vielen Dank für dein Interesse, zu **STL-Storage Hub** beizutragen! Dieses Projekt ist Open-Source unter der **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** Lizenz für Maker und 3D-Druck-Enthusiasten.

---

## 🛠️ Entwicklungs-Setup

1. **Repository klonen**
   ```bash
   git clone <dein-fork-url>
   cd STL-Storage
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```
   - Der Server läuft auf `http://localhost:3001`
   - Die Vite Client-Oberfläche läuft auf `http://localhost:5173` (mit automatischem API-Proxy)

---

## 📋 Richtlinien für Pull Requests

- **Code Quality:** Halte dich an sauberen, modularen JavaScript/React-Code.
- **Responsiveness & Usability:** Neue UI-Komponenten müssen sowohl auf Desktop als auch auf mobilen Geräten gut bedienbar sein.
- **Three.js Performance:** Achte darauf, Geometrien und Materialien beim Wechsel von Modellen sauber über `.dispose()` freizugeben, um Speicherlecks zu verhindern.
- **Nicht-kommerzielle Nutzung:** Alle Beiträge fallen unter die CC BY-NC 4.0 Lizenz.

---

## 💡 Feature-Vorschläge & Fehler melden

Öffne gerne ein [GitHub Issue](https://github.com/michaelschellenberger/stl-storage/issues) mit:
1. Einer aussagekräftigen Beschreibung
2. Schritten zur Reproduktion (bei Fehlern)
3. Bildschirmfotos oder Beispieldateien (.stl / .3mf)

---

*Erstellt mit ❤️ von Michael Schellenberger für die 3D-Druck Community.*
