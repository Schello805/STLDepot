# 📦 STLDepot (STL-Storage Hub)

<p align="center">
  <img src="assets/logo.png" alt="STLDepot Logo" width="180"/>
</p>

<p align="center">
  <strong>Moderner, skalierbarer Open-Source 3D-Druck-Katalog für STL- und 3MF-Dateien mit Three.js WebGL-Vorschau und Slicer-Integration.</strong>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/Three.js-WebGL%203D-06b6d4?style=for-the-badge&logo=three.js" alt="Three.js"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/React-Vite-61dafb?style=for-the-badge&logo=react" alt="React"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Backend-Node%20%2B%20Express-339933?style=for-the-badge&logo=node.js" alt="Node.js"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Database-SQLite%20WAL-003B57?style=for-the-badge&logo=sqlite" alt="SQLite"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lizenz-CC%20BY--NC%204.0-orange?style=for-the-badge" alt="CC BY-NC 4.0"></a>
</p>

---

## 🌟 Überblick

**STL-Storage Hub** ist ein schneller, eleganter und benutzerfreundlicher 3D-Modell-Tresor für Maker und 3D-Druck-Enthusiasten. Die Web-Anwendung ermöglicht das übersichtliche Verwalten, Durchsuchen und Betrachten aller deiner `.stl` und `.3mf` Dateien – inklusive 3D-Drehvorschau, automatischer Bemaßung, Volumenberechnung und One-Click-Übergabe an gängige Slicer wie **OrcaSlicer**, **Bambu Studio**, **PrusaSlicer** und **Cura**.

---

## 🚀 Hauptfunktionen (Features)

### 🧊 1. Interaktiver 3D-WebGL-Viewer
- **Echtzeit 3D-Rendering:** Drehen, Zoomen und Schwenken von Modellen im Browser (Desktop & Mobil).
- **STL & 3MF Parser:** Volle Unterstützung für binäre und ASCII STL-Dateien sowie komprimierte 3MF-Pakete.
- **Automatische Bemaßung:** Zeigt exakte Abmessungen ($X \times Y \times Z$ in mm) und berechnet das Modellvolumen in $\text{cm}^3$ sowie das geschätzte Filamentgewicht in Gramm.
- **Druckbett-Referenz:** 256×256 mm Druckbett-Gitter (Bambu Lab / Prusa Standard) mit Bodenprojektion.
- **Ansichten & Shader:** Wechsel zwischen Isometrischer Ansicht, Draufsicht, Frontansicht sowie Shader-Modi (*Solid*, *Gitter/Wireframe*, *Glanz/Metallic*).
- **Live-Farbwähler:** Passe die Farbe des 3D-Modells in Echtzeit an deine gewünschte Filamentfarbe an.
- **Snapshot als Vorschaubild:** Speichere mit einem Klick deinen aktuellen Blickwinkel als neues Vorschaubild für die Karte.

### 📁 2. Katalog & Organisation
- **Live-Volltextsuche:** Blitzschnelle Suche nach Titel, Filamenttyp, Tags, Notizen und Beschreibungen.
- **Kategorien & Tags:** Filter nach Kategorien (*Deko*, *Werkzeuge*, *Gaming*, *Kalibrierung*, etc.) und Schlagwörtern.
- **Mehrteilige Baugruppen:** Gruppiere mehrere STL-Teile in einem Projekt und wechsle im 3D-Viewer nahtlos zwischen den Einzelteilen.
- **Favoriten:** Markiere deine wichtigsten Modelle mit einem Klick auf das Herz-Symbol.
- **Druckparameter-Dokumentation:** Speichere Infill, Düsengröße, Druckzeit, Stützen-Bedarf und Filament-Typ.

### 🖨️ 3. Slicer-Integration & Downloads
- **Direktes Öffnen im Slicer:**
  - 🎋 **Bambu Studio** (`bambustudio://`)
  - 🐋 **OrcaSlicer** (`orcaslicer://`)
  - 🔶 **PrusaSlicer** (`prusaslicer://`)
  - ⚙️ **UltiMaker Cura** (`cura://`)
- **Projekt-ZIP-Download:** Lädt alle Projektdateien zusammen mit einer automatisch generierten `Druckhinweise.txt` Datei herunter.

### 🔄 4. Automatischer Ordner-Scanner (Watcher)
- **Drop & Index:** Lege neue STL/3MF Dateien in den Ordner `data/watch_import` – der Hintergrund-Watcher erfasst und katalogisiert sie automatisch.
- **Manueller Verzeichnis-Scan:** Scanne bestehende Festplatten oder Netzlaufwerke über die Weboberfläche.

---

## 🛠️ Schnellstart & Installation

### Option 1: Lokale Installation (Node.js)

**Voraussetzungen:** [Node.js](https://nodejs.org/) (Version 18 oder neuer)

1. **Repository klonen:**
   ```bash
   git clone https://github.com/Schello805/STLDepot.git
   cd STLDepot
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Entwicklungsmodus starten:**
   ```bash
   npm run dev
   ```
   - Öffne [http://localhost:5173](http://localhost:5173) im Browser.
   - Der Backend-Server läuft auf `http://localhost:3001`.

4. **Produktionsmodus starten:**
   ```bash
   npm run build
   npm run server
   ```
   - Öffne [http://localhost:3001](http://localhost:3001) im Browser.

---

### Option 2: Docker & Docker-Compose (Empfohlen für NAS / Heimserver)

Starte die Anwendung mit einem einzigen Befehl:

```bash
docker compose up -d --build
```

- Die Weboberfläche ist anschließend unter `http://<DEINE-IP>:3001` erreichbar.
- Alle Daten, 3D-Modelle und Thumbnails werden persistent im lokalen Ordner `./data` gespeichert.

---

### Option 3: CapRover One-Click Deployment (PaaS Cloud & VPS)

STLDepot bringt eine fertige `captain-definition` mit und kann direkt auf deinem **CapRover Server** betrieben werden:

1. **Neue App in CapRover anlegen:**
   - Gehe in dein CapRover Dashboard zu **Apps** -> **Create New App**.
   - Name eingeben: z. B. `stldepot`.
   - Setze einen Haken bei **"Has Persistent Data"** und klicke auf *Create New App*.

2. **Persistenten Speicherpfad mounten:**
   - Öffne die App-Einstellungen -> Reiter **App Configs**.
   - Scrolle zu **Persistent Directories** und füge folgenden Pfad hinzu:
     - **Path in Container:** `/app/data`
     - **Label:** `stldepot-data`
   - Klicke auf *Save & Update*.

3. **Deployen:**
   - **Variante A (GitHub Verlinkung - Empfohlen):**
     - Gehe zum Reiter **Deployment** -> **Deploy from Github/Bitbucket**.
     - Repository URL: `https://github.com/Schello805/STLDepot`
     - Branch: `main`
     - Klicke auf *Save & Build*.
   - **Variante B (CapRover CLI):**
     ```bash
     caprover deploy -a stldepot
     ```

4. **SSL / HTTPS aktivieren:**
   - Im Reiter **HTTP Settings** kannst du mit einem Klick ein kostenloses **Let's Encrypt SSL-Zertifikat** aktivieren.
   - Fertig! Dein STL-Storage Hub ist nun weltweit gesichert unter deiner Subdomain erreichbar.

---

## 📂 Projektstruktur

```text
STL-Storage/
├── client/                     # Frontend (React + Vite + Three.js + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # UI-Komponenten (Navbar, ModelCard, ViewerModal, etc.)
│   │   ├── utils/              # 3D STL/3MF Parser, Snapshot- & Bemaßungs-Utilities
│   │   ├── App.jsx             # Haupt-Applikation
│   │   └── index.css           # Styling mit modernem Dark Theme
│   └── vite.config.js          # Vite Konfiguration
├── server/                     # Backend (Node.js + Express)
│   ├── routes/
│   │   ├── models.js           # REST-API für Modelle, Uploads & ZIP-Downloads
│   │   └── system.js           # System-Info, Revisionsnummer & Scanner-Trigger
│   ├── db.js                   # SQLite Datenbank Initialisierung (better-sqlite3)
│   ├── scanner.js              # Background Folder Watcher (chokidar)
│   └── index.js                # Server Entrypoint
├── data/                       # Persistenter Datenspeicher
│   ├── models/                 # Gespeicherte 3D-Dateien
│   ├── thumbnails/             # Generierte Vorschaubilder
│   ├── watch_import/           # Ordner für automatischen Import
│   └── stl_storage.db          # SQLite Datenbankdatei
├── Dockerfile                  # Multi-Stage Docker Build
├── docker-compose.yml          # Container Orchestrierung
├── LICENSE                     # CC BY-NC 4.0 Lizenz
└── README.md                   # Projektdokumentation
```

---

## 📜 Lizenz & Urheberrecht

Dieses Projekt ist Open Source und steht unter der **[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](LICENSE)** Lizenz.

- ✅ **Erlaubt:** Kostenlose private Nutzung, Modifikation und Weitergabe für Maker und Bastler.
- ❌ **Nicht erlaubt:** Kommerzielle Nutzung oder der Verkauf der Software ohne vorherige schriftliche Genehmigung.

**Entwickelt von:** [Michael Schellenberger](https://github.com/michaelschellenberger)
