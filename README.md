# Pi-Deck

A web interface for [Pi](https://github.com/badlogic/pi-mono), the terminal coding agent. This is a personal project I built for my own workflow — it lets me use Pi from a browser instead of the terminal, with multi-workspace support so I can manage several projects at once.

> **Note:** This is personal tooling, not a general-purpose product. It works for my setup and I make no guarantees about stability, compatibility, or support. Feel free to fork or take ideas from it.

## Features

- **Multi-workspace tabs** — open multiple project directories side by side
- **Real-time streaming** — chat with Pi via WebSocket, see responses as they arrive
- **Tool visualization** — watch tool calls execute with live output
- **Thinking blocks** — collapsible display for reasoning model internals
- **Session management** — switch between sessions, pick models per workspace
- **Image support** — paste or drag images into prompts
- **Persistent state** — open workspaces, theme, and drafts sync across devices via SQLite
- **Directory allowlist** — control which directories are accessible from the UI

## Stack

- **Frontend:** React 19, Vite, TailwindCSS
- **Backend:** Express, WebSocket, Pi SDK
- **Storage:** SQLite for UI state

## Install from npm

```bash
npm install -g pi-deck
pi-deck
```

Or run without installing:

```bash
npx pi-deck
```

Requires Node.js 20+ and an API key configured (e.g. `ANTHROPIC_API_KEY`).

Open `http://localhost:9741` in your browser.

### CLI options

```
pi-deck                # start the server on port 9741
pi-deck --port 8080    # use a custom port
pi-deck --build        # rebuild before starting (for local dev)
pi-deck --help         # show all options
```

## Development setup

Clone the repo and install dependencies:

```bash
git clone https://github.com/user/pi-deck.git
cd pi-deck
npm install
```

### Dev mode (hot-reload)

```bash
npm run dev       # frontend on :9740, backend on :9741
```

### Production mode (no hot-reload)

```bash
npm run build     # build everything
npm start         # start the server on :9741
```

### Local CLI

To use the `pi-deck` command from your local checkout:

```bash
npm run build
npm link          # creates a global 'pi-deck' symlink
pi-deck           # works from any directory
```

To remove: `npm unlink -g pi-deck`

## Publishing to npm

```bash
npm run publish:npm patch      # 0.1.0 → 0.1.1
npm run publish:npm minor      # 0.1.0 → 0.2.0
npm run publish:npm major      # 0.1.0 → 1.0.0
npm run publish:npm patch -- --dry-run   # preview without publishing
```

The script will: check for a clean working tree on `main`, bump the version in all `package.json` files, build, run tests, publish to npm, commit, tag, and push.

The published package includes a bundled server (`dist/server.js`) and the pre-built client SPA (`packages/client/dist/`). Workspace dependencies are inlined by esbuild; only runtime dependencies (`express`, `better-sqlite3`, etc.) are installed by npm.

## Job Management

Pi-deck integrates with Pi's job management system. Jobs are markdown files with YAML frontmatter that track work through phases (backlog → planning → ready → executing → review → complete).

### Configurable Job Locations

By default, jobs are stored in two locations:
- `~/.pi/agent/jobs/<workspace-name>/` (primary)
- `<workspace>/.pi/jobs/` (local)

You can configure custom job directories by creating a `.pi/jobs.json` file in your workspace root:

```json
{
  "locations": [
    "~/.pi/agent/jobs/pi-deck",
    ".pi/jobs",
    "./custom-jobs-folder",
    "/absolute/path/to/jobs"
  ],
  "defaultLocation": "~/.pi/agent/jobs/pi-deck"
}
```

**Configuration options:**
- `locations` (required): Array of directory paths to scan for jobs. Supports:
  - Relative paths (resolved from workspace root): `"./jobs"`, `".pi/jobs"`
  - Absolute paths: `"/Users/you/projects/jobs"`
  - Home directory expansion: `"~/.pi/agent/jobs"`
- `defaultLocation` (optional): Where new jobs are created. If not specified, uses the first location in `locations`.

The configuration file is optional — without it, the default two-location behavior is preserved for backward compatibility.

See `.pi/jobs.json.example` for a template.

## Configuration

Create a config file at `~/.config/pi-deck/config.json`:

```json
{
  "port": 9741,
  "host": "0.0.0.0",
  "allowedDirectories": ["~/projects", "~/code"]
}
```

Or use environment variables: `PORT`, `HOST`, `PI_ALLOWED_DIRS` (colon-separated).

## Running as a service

I run this on a Mac mini with Tailscale for always-on access from any device.

```bash
npm run service:install    # install as launchd service (starts on login)
npm run service:uninstall  # remove it
```

Logs go to `~/Library/Logs/pi-deck/`.

## License

MIT
