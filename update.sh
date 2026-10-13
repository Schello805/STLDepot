#!/usr/bin/env bash
# ==============================================================================
# 🔄 STLDepot (STL-Storage Hub) - Automatisches Update-Skript
# Aktualisiert Code, Abhängigkeiten, Frontend-Build und startet den Dienst neu
# Lizenz: CC BY-NC 4.0 | Entwickelt von Michael Schellenberger
# ==============================================================================

set -Eeuo pipefail

# Farben für Terminal-Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____ _____ _     ____                  _   
 / ___|_   _| |   |  _ \  ___ _ __   ___| |_ 
 \___ \ | | | |   | | | |/ _ \ '_ \ / _ \ __|
  ___) || | | |___| |_| |  __/ |_) | (_) | |_ 
 |____/ |_| |_____|____/ \___| .__/ \___/ \__|
                             |_|              
       🔄 STLDepot - System Update
EOF
echo -e "${NC}"

# 1. Installationsverzeichnis ermitteln
TARGET_DIR=""

# Fall A: Skript liegt in einem geklonten Repository
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  CANDIDATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -d "$CANDIDATE_DIR/.git" ]; then
    TARGET_DIR="$CANDIDATE_DIR"
  fi
fi

# Fall B: Standard-Pfad /opt/stldepot (z. B. wenn via curl | bash ausgeführt)
if [ -z "$TARGET_DIR" ]; then
  if [ -d "/opt/stldepot/.git" ]; then
    TARGET_DIR="/opt/stldepot"
  elif [ -d "$PWD/.git" ]; then
    TARGET_DIR="$PWD"
  else
    echo -e "${RED}❌ Kein STLDepot Git-Repository gefunden!${NC}"
    echo -e "${YELLOW}Bitte wechsle in das STLDepot-Verzeichnis oder installiere es unter /opt/stldepot.${NC}"
    exit 1
  fi
fi

echo -e "${BOLD}🚀 Starte Update für:${NC} ${CYAN}${TARGET_DIR}${NC}\n"
cd "$TARGET_DIR"

# 2. Prüfen auf lokale ungesicherte Änderungen
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Lokale Änderungen in ${TARGET_DIR} gefunden!${NC}"
  echo -e "${YELLOW}Um Datenverlust zu vermeiden, wird das Update abgebrochen.${NC}"
  echo -e "Prüfe deine Änderungen mit: ${BOLD}git status${NC}"
  echo -e "Oder sichere sie mit:      ${BOLD}git stash${NC}\n"
  exit 1
fi

# 3. Vorherige Version ermitteln
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unbekannt")

# 4. Neuesten Stand von Git holen
echo -e "${CYAN}➜ 1/4: Hole neuesten Stand von GitHub...${NC}"
git fetch origin main --quiet
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
  echo -e "${GREEN}✓ STLDepot ist bereits auf dem aktuellsten Stand (${OLD_COMMIT}).${NC}"
else
  git pull --ff-only origin main
  NEW_COMMIT=$(git rev-parse --short HEAD)
  echo -e "${GREEN}✓ Quellcode aktualisiert: ${OLD_COMMIT} ➜ ${NEW_COMMIT}${NC}"
fi

# Den CLI-Wrapper direkt nach dem Pull erneuern. Damit werden auch alte
# Installationen repariert, deren Wrapper noch bedingungslos `sudo` aufruft.
if [ -f "$TARGET_DIR/scripts/stldepot-cli" ]; then
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    install -m 0755 "$TARGET_DIR/scripts/stldepot-cli" /usr/local/bin/stldepot
  elif command -v sudo >/dev/null 2>&1; then
    sudo install -m 0755 "$TARGET_DIR/scripts/stldepot-cli" /usr/local/bin/stldepot
  elif [ -w /usr/local/bin ]; then
    install -m 0755 "$TARGET_DIR/scripts/stldepot-cli" /usr/local/bin/stldepot
  else
    echo -e "${YELLOW}⚠️ CLI konnte ohne root-Rechte nicht aktualisiert werden.${NC}"
  fi
fi

# 5. Node.js & npm Abhängigkeiten installieren
echo -e "${CYAN}➜ 2/4: Aktualisiere Backend- und Frontend-Abhängigkeiten...${NC}"
if [ -f "package-lock.json" ]; then
  npm ci --silent
else
  npm install --silent
fi

if [ -f "client/package-lock.json" ]; then
  npm ci --prefix client --silent
else
  npm install --prefix client --silent
fi
echo -e "${GREEN}✓ Abhängigkeiten sind auf dem neuesten Stand.${NC}"

# 6. Frontend kompilieren
echo -e "${CYAN}➜ 3/4: Erzeuge optimierten Produktions-Build des Frontends...${NC}"
npm run build --prefix client --silent
echo -e "${GREEN}✓ Frontend erfolgreich kompiliert.${NC}"

# 7. Dienst oder Container neu starten
echo -e "${CYAN}➜ 4/4: Starte Dienst neu...${NC}"

RESTARTED=false

# Fall A: Systemd Service aktiv
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet stldepot.service 2>/dev/null; then
    if [ "$EUID" -eq 0 ]; then
      systemctl restart stldepot.service
    elif command -v sudo >/dev/null 2>&1; then
      sudo systemctl restart stldepot.service
    fi
    sleep 2
    if systemctl is-active --quiet stldepot.service; then
      echo -e "${GREEN}✓ Systemd-Dienst (stldepot.service) erfolgreich neu gestartet.${NC}"
      RESTARTED=true
    else
      echo -e "${YELLOW}⚠️ Dienst konnte nicht verifiziert werden. Prüfe Status mit: systemctl status stldepot${NC}"
    fi
  fi
fi

# Fall B: Docker Compose
if [ "$RESTARTED" = false ] && command -v docker >/dev/null 2>&1; then
  if [ -f "docker-compose.yml" ] && docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "stldepot"; then
    echo -e "${CYAN}➜ Starte Docker-Container neu...${NC}"
    docker compose down && docker compose up -d --build
    RESTARTED=true
    echo -e "${GREEN}✓ Docker-Container erfolgreich aktualisiert und gestartet.${NC}"
  fi
fi

if [ "$RESTARTED" = false ]; then
  echo -e "${YELLOW}ℹ Kein aktiver Hintergrunddienst (systemd/docker) erkannt.${NC}"
  echo -e "${YELLOW}  Falls du den Server manuell im Terminal betreibst, starte ihn jetzt neu mit: npm start${NC}"
fi

# 9. Abschlussmeldung
CURRENT_REV=$(git rev-parse --short HEAD 2>/dev/null || echo "")

echo -e "\n${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 STLDepot wurde erfolgreich aktualisiert!${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
[ -n "$CURRENT_REV" ] && echo -e "Aktuelle Git-Revision:    ${CYAN}${CURRENT_REV}${NC}"
echo -e "Projektverzeichnis:       ${CYAN}${TARGET_DIR}${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}\n"
