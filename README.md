# Bedrock Admin

Web-basiertes Admin-Panel für Minecraft Bedrock Dedicated Server mit Passkey-Authentifizierung.

## Features

- **Passkey-Login** — WebAuthn/FIDO2, keine Passwörter
- **Server-Steuerung** — Start, Stop, Restart via Docker
- **server.properties Editor** — alle Einstellungen im Browser ändern
- **Allowlist & Berechtigungen** — Spieler verwalten
- **Welten-Verwaltung** — erstellen, wechseln
- **Einladungssystem** — weitere Admins per Invite-Link hinzufügen
- **Recovery-Codes** — Zugang wiederherstellen ohne Passkey

## Voraussetzung

Ein laufender Minecraft Bedrock Dedicated Server (z.B. als Docker-Container). Bedrock Admin verbindet sich über den Docker-Socket und das Datenverzeichnis.

## Quick Start

```bash
cp .env.example .env
# .env anpassen (Domain, Pfade, Session-Secret)
docker compose up -d
```

Beim ersten Aufruf wird der Setup-Wizard angezeigt, um den ersten Admin-Account anzulegen.

## Konfiguration

Alle Einstellungen über `.env` (siehe `.env.example`):

| Variable | Beschreibung | Default |
|---|---|---|
| `RP_ID` | WebAuthn Relying Party ID (Domain) | `localhost` |
| `RP_NAME` | Anzeigename | `Bedrock Admin` |
| `ORIGIN` | Vollständige Origin-URL | `https://{RP_ID}` |
| `BEDROCK_DATA_PATH` | Pfad zum Bedrock-Datenverzeichnis auf dem Host | `/opt/bedrock/data` |
| `BEDROCK_CONTAINER_NAME` | Name des laufenden Bedrock Docker-Containers | `bedrock` |
| `SESSION_SECRET` | Secret für Session-Cookies | — |

## Architektur

```
Caddy (TLS/Reverse Proxy) → Express (Admin API) → Docker Socket
                                    ↓
                              SQLite (Users, Credentials, Invites)
                              Bedrock-Daten (Properties, Allowlist, Worlds)
```

## Docker Image

Das Image wird bei jedem Push auf `main` automatisch gebaut:

```
ghcr.io/langdar2/bedrock-admin:latest
```

## Entwicklung

```bash
npm install
npm run dev   # startet mit --watch
```
