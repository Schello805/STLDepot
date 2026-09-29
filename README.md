# 📦 STLDepot (STL-Storage Hub)

<p align="center">
  <img src="client/public/logo.png" alt="STLDepot Logo" width="180"/>
</p>

<p align="center">
  <strong>Moderner, skalierbarer Open-Source 3D-Druck-Katalog für STL- und 3MF-Dateien mit Three.js WebGL-Vorschau und Slicer-Integration.</strong>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/Three.js-WebGL%203D-06b6d4?style=for-the-badge&logo=three.js" alt="Three.js"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/React-Vite-61dafb?style=for-the-badge&logo=react" alt="React"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Backend-Node%20%2B%20Express-339933?style=for-the-badge&logo=node.js" alt="Node.js"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Database-SQLite%20WAL-003B57?style=for-the-badge&logo=sqlite" alt="SQLite"></a>
  <a href="https://github.com/Schello805/aiprintstudio"><img src="https://img.shields.io/badge/macOS%20App-AIPrintStudio-black?style=for-the-badge&logo=apple" alt="AIPrintStudio"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lizenz-CC%20BY--NC%204.0-orange?style=for-the-badge" alt="CC BY-NC 4.0"></a>
</p>

---

## 🍎 Begleit-App für den Mac: AIPrintStudio

> [!TIP]
> **Für macOS-Nutzer:** Schau dir auch das Projekt **[AIPrintStudio](https://github.com/Schello805/aiprintstudio)** an – die native KI-gestützte Begleit-App für 3D-Druck, Slicer-Steuerung und Filament-Management auf dem Mac!

---

## 🌟 Überblick

**STL-Storage Hub (STLDepot)** ist ein schneller, eleganter und benutzerfreundlicher 3D-Modell-Tresor für Maker und 3D-Druck-Enthusiasten. Die Web-Anwendung ermöglicht das übersichtliche Verwalten, Durchsuchen und Betrachten aller deiner `.stl` und `.3mf` Dateien – inklusive 3D-Drehvorschau, automatischer Bemaßung, Volumenberechnung, Werkstatt-QR-Etiketten und One-Click-Übergabe an gängige Slicer wie **OrcaSlicer**, **Bambu Studio**, **PrusaSlicer** und **Cura**.

---

## 🚀 Hauptfunktionen (Features)

### 🧊 1. Interaktiver 3D-WebGL-Viewer & Pro-Tools
- **Echtzeit 3D-Rendering:** Drehen, Zoomen und Schwenken von Modellen im Browser (Desktop, Tablet & Smartphone).
- **STL & 3MF Parser:** Volle Unterstützung für binäre und ASCII STL-Dateien sowie 3MF-Pakete (OrcaSlicer, Bambu Studio, PrusaSlicer).
- **Punkt-zu-Punkt Messwerkzeug (Pro):** Klicke zwei beliebige Stellen am 3D-Modell an, um den exakten Abstand in **Millimetern (mm)** live zu messen.
- **Schnitt-Ebene / Cross-Section (Pro):** Schneide Modelle interaktiv entlang der X-, Y- oder Z-Achse an, um Wandstärken und innere Hohlräume zu prüfen.
- **Automatische Bemaßung:** Exakte Dimensionen ($X \times Y \times Z$ in mm), Volumenberechnung ($\text{cm}^3$) und geschätztes Filamentgewicht (~PLA g).
- **Snapshot als Vorschaubild:** Speichere den aktuellen 3D-Blickwinkel als offizielles Thumbnail für das Modell.

### 🌐 2. Web-Importer (MakerWorld, Printables, Thingiverse)
- **One-Click URL-Import:** Füge Modell-URLs von *MakerWorld*, *Printables*, *Thingiverse* oder direkte `.stl`/`.3mf` Download-Links ein.
- **Automatischer Metadaten-Download:** Extrahiert Titel, Beschreibung, Designer-Name und lädt die 3D-Dateien direkt in deinen lokalen Tresor.

### 🏷️ 3. Werkstatt-Etiketten & QR-Code Generator
- **Druckfertige Labels:** Generiere QR-Code-Aufkleber mit Modellname, Maßen, Filament-Informationen und Druckzeit.
- **Ideal für Teileboxen:** Klebe das Etikett auf Schubladen, Euroboxen oder Spulen und scanne den Code mit dem Smartphone, um sofort das 3D-Modell im Browser aufzurufen.

### 📱 4. PWA (Progressive Web App)
- **Installierbar als App:** Auf iOS, Android, macOS und Windows direkt aus dem Browser als eigenständige Vollbild-App installierbar.
- **Offline-Caching:** Schnelleres Laden und Offline-Verfügbarkeit.

### 🖨️ 5. Slicer-Integration & Downloads
- **Direktes Öffnen im Slicer:**
  - 🎋 **Bambu Studio** (`bambustudio://`)
  - 🐋 **OrcaSlicer** (`orcaslicer://`)
  - 🔶 **PrusaSlicer** (`prusaslicer://`)
  - ⚙️ **UltiMaker Cura** (`cura://`)
- **Projekt-ZIP-Download:** Lädt alle Projektdateien zusammen mit einer formatierten `Druckhinweise.txt` Datei herunter.

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
