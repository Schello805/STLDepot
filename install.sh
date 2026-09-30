#!/usr/bin/env bash
# ==============================================================================
# 📦 STLDepot (STL-Storage Hub) - Automatischer Linux One-Liner Installer
# Unterstützt: Ubuntu, Debian, Raspberry Pi OS, Armbian, Proxmox LXC
# Lizenz: CC BY-NC 4.0 | Entwickelt von Michael Schellenberger
# ==============================================================================

set -e

# Farben für Terminal-Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____ _____ _     ____                  _   
 / ___|_   _| |   |  _ \  ___ _ __   ___| |_ 
 \___ \ | | | |   | | | |/ _ \ '_ \ / _ \ __|
  ___) || | | |___| |_| |  __/ |_) | (_) | |_ 
 |____/ |_| |_____|____/ \___| .__/ \___/ \__|
                             |_|              
           STL-Storage Hub & Slicer Vault
EOF
echo -e "${NC}"
echo -e "${BOLD}🚀 Starte automatische Installation für Linux...${NC}\n"

# 1. Root / Sudo Prüfung
IS_ROOT=false
if [ "$EUID" -eq 0 ]; then
  IS_ROOT=true
fi

SUDO_CMD=""
if [ "$IS_ROOT" = false ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  else
    echo -e "${RED}❌ Bitte führe das Skript als root oder mit installiertem sudo aus.${NC}"
    exit 1
  fi
fi

# 2. Zielverzeichnis festlegen
INSTALL_DIR="/opt/stldepot"
REPO_URL="https://github.com/Schello805/STLDepot.git"

echo -e "${CYAN}➜ Prüfe System-Abhängigkeiten...${NC}"

# 3. Paketmanager ermitteln und Basis-Tools installieren (git, curl)
if command -v apt-get >/dev/null 2>&1; then
  $SUDO_CMD apt-get update -qq
  $SUDO_CMD apt-get install -y -qq git curl build-essential ca-certificates gnupg >/dev/null 2>&1
elif command -v dnf >/dev/null 2>&1; then
  $SUDO_CMD dnf install -y git curl gcc-c++ make >/dev/null 2>&1
elif command -v pacman >/dev/null 2>&1; then
  $SUDO_CMD pacman -Sy --noconfirm git curl base-devel >/dev/null 2>&1
fi

# 4. Node.js (mindestens v18, empfohlen v20 LTS) prüfen oder installieren
NEED_NODE=false
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=true
else
  NODE_VER=$(node -v | cut -d'.' -f1 | sed 's/v//')
  if [ "$NODE_VER" -lt 18 ]; then
    echo -e "${YELLOW}⚠️ Installiertes Node.js ($NODE_VER) ist zu alt. Benötige Node 18+.${NC}"
    NEED_NODE=true
  fi
fi

if [ "$NEED_NODE" = true ]; then
  echo -e "${CYAN}➜ Installiere Node.js 20 LTS (NodeSource)...${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO_CMD bash - >/dev/null 2>&1
    $SUDO_CMD apt-get install -y nodejs >/dev/null 2>&1
  else
    echo -e "${RED}❌ Bitte installiere manuell Node.js 18+ und starte das Skript erneut.${NC}"
    exit 1
  fi
fi

NODE_INSTALLED_VER=$(node -v)
echo -e "${GREEN}✓ Node.js ist bereit: ${NODE_INSTALLED_VER}${NC}"

# 5. Repository klonen oder aktualisieren
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${CYAN}➜ Aktualisiere bestehende Installation in ${INSTALL_DIR}...${NC}"
  cd "$INSTALL_DIR"
  $SUDO_CMD git fetch origin main
  $SUDO_CMD git reset --hard origin/main
else
  echo -e "${CYAN}➜ Klone STLDepot nach ${INSTALL_DIR}...${NC}"
  $SUDO_CMD rm -rf "$INSTALL_DIR"
  $SUDO_CMD git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 6. Berechtigungen anpassen
CURRENT_USER=$(logname 2>/dev/null || echo "$SUDO_USER")
if [ -z "$CURRENT_USER" ] || [ "$CURRENT_USER" = "root" ]; then
  CURRENT_USER="root"
fi
$SUDO_CMD chown -R "$CURRENT_USER":"$CURRENT_USER" "$INSTALL_DIR"

# 7. Abhängigkeiten installieren & Client kompilieren
echo -e "${CYAN}➜ Installiere Backend- und Frontend-Abhängigkeiten (kann 1-2 Min. dauern)...${NC}"
npm install --silent

echo -e "${CYAN}➜ Erzeuge optimierten Produktions-Build des Frontends...${NC}"
npm run build --prefix client --silent

# 8. Verzeichnisse anlegen
mkdir -p "$INSTALL_DIR/data/models" "$INSTALL_DIR/data/thumbnails" "$INSTALL_DIR/data/watch_import"

# 9. Systemd Service einrichten für automatischen Start bei Boot
SERVICE_FILE="/etc/systemd/system/stldepot.service"
echo -e "${CYAN}➜ Konfiguriere Systemd-Dienst (${SERVICE_FILE})...${NC}"

NODE_BIN_PATH=$(which node)

$SUDO_CMD bash -c "cat > ${SERVICE_FILE}" << EOF
[Unit]
Description=STLDepot - 3D Printing Storage Vault
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN_PATH} server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

$SUDO_CMD systemctl daemon-reload
$SUDO_CMD systemctl enable stldepot.service
$SUDO_CMD systemctl restart stldepot.service

# 10. CLI-Kurzbefehl 'stldepot' erstellen
CLI_PATH="/usr/local/bin/stldepot"
$SUDO_CMD bash -c "cat > ${CLI_PATH}" << 'EOF'
#!/bin/bash
case "$1" in
  update)
    echo "Aktualisiere STLDepot..."
    cd /opt/stldepot && git pull origin main && npm install && npm run build --prefix client && sudo systemctl restart stldepot
    echo "Aktualisierung abgeschlossen!"
    ;;
  restart)
    sudo systemctl restart stldepot
    ;;
  status)
    sudo systemctl status stldepot
    ;;
  logs)
    sudo journalctl -u stldepot -f
    ;;
  *)
    echo "Verwendung: stldepot {update|restart|status|logs}"
    ;;
esac
EOF
$SUDO_CMD chmod +x "$CLI_PATH"

# 11. IP-Adresse ermitteln
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP_ADDR" ]; then
  IP_ADDR="localhost"
fi

echo -e "\n${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 Installation von STLDepot erfolgreich abgeschlossen!${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e "Weboberfläche aufrufen:   ${CYAN}${BOLD}http://${IP_ADDR}:3001${NC}"
echo -e "Lokaler Speicherordner:   ${YELLOW}${INSTALL_DIR}/data${NC}"
echo -e "Auto-Import-Verzeichnis:  ${YELLOW}${INSTALL_DIR}/data/watch_import${NC}"
echo -e "Systemd-Dienststatus:     ${CYAN}sudo systemctl status stldepot${NC}"
echo -e "Live-Logs ansehen:        ${CYAN}stldepot logs${NC}"
echo -e "Einfaches Update später:  ${CYAN}stldepot update${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}\n"
