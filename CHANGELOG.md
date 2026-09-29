# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-29

### Initialer Release

#### ✨ Features
- **3D-WebGL-Viewer (Three.js):**
  - Interaktive 360° Ansicht mit OrbitControls (Drehen, Schwenken, Zoomen).
  - Volle Unterstützung für binäre und ASCII `.stl` sowie `.3mf` Dateiformate.
  - Dynamische Druckbett-Vorschau (256×256 mm) mit Achsen und Gitter.
  - Echtzeit-Bemaßung (X, Y, Z in Millimetern), Volumenberechnung in cm³ und Schätzung des Filamentgewichts.
  - Ansichtswechsel (Isometric, Top, Front, Right) und Shading-Modi (Solid, Wireframe, Metallisch).
  - Filament-Farbwähler mit Live-Materialvorschau.
  - Snapshot-Funktion: Aktuelle Kameraperspektive als Vorschaubild für die Karte speichern.
- **Katalog & Organisation:**
  - Schnelle Live-Volltextsuche nach Modellname, Beschreibung, Filament, Drucknotizen und Tags.
  - Kategorien-Filter, Tag-Chips und Favoriten-Markierung.
  - Mehrteilige Baugruppen-Projekte (mehrere STLs in einem Eintrag mit Teil-Umschalter).
  - Drag & Drop Upload-Dialog mit automatischer Vorab-Thumbnail-Generierung.
- **Slicer-Integration:**
  - Direkte URL-Protokoll-Übergabe an **Bambu Studio** (`bambustudio://`), **OrcaSlicer** (`orcaslicer://`), **PrusaSlicer** (`prusaslicer://`) und **Cura** (`cura://`).
  - 1-Klick Projekt-Download als ZIP inklusive aller Druckparameter und Hinweise (`Druckhinweise.txt`).
- **Automatischer Ordner-Scanner:**
  - Hintergrundüberwachung von `data/watch_import` für automatischen Import neuer 3D-Dateien.
  - Manueller Scanner-Dialog für lokale Pfade und Netzlaufwerke.
- **Architektur & Deployment:**
  - Fullstack mit Node.js/Express & React (Vite, Three.js, Lucide Icons, Tailwind CSS).
  - Lokale persistente SQLite-Datenbank (`better-sqlite3`).
  - Docker & Docker-Compose Support für 1-Klick Self-Hosting.
  - Dynamischer Footer mit automatischer Revisionsnummer und CC BY-NC 4.0 Lizenz.
