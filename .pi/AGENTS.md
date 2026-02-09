# Pi-Deck Project Notes

## Development Workflow

### Running Local Development Version

To run the local development version instead of the npm installed version:

```bash
# Build the project
npm run build

# Run with local client dist
PI_DECK_CLIENT_DIST=$(pwd)/packages/client/dist node packages/server/dist/index.js
```

### Publishing a New Version

1. Commit all changes
2. Bump version: `npm version patch` (or minor/major)
3. Publish: `npm publish --otp=YOUR_OTP_CODE`
4. The npm installed version will automatically pick up the new version

### Switching Between Local and NPM Version

**Kill all running instances:**
```bash
lsof -ti:9741 | xargs kill -9
```

**Run local version:**
```bash
PI_DECK_CLIENT_DIST=$(pwd)/packages/client/dist node packages/server/dist/index.js
```

**Run npm version:**
```bash
pi-deck
# Or if using launchd:
launchctl start com.pi-deck.server
```

## Recent Changes

### v0.1.5 - Removed Allowed Directories Restriction

- **BREAKING**: Removed `allowedDirectories` security feature
- Any directory on the filesystem can now be opened as a workspace
- The `allowedDirectories` config option is no longer read
- Directory browser now shows home directory as root instead of allowed roots list

### Project Structure

- `packages/server/` - Express server + WebSocket handling
- `packages/client/` - React frontend
- `packages/shared/` - Shared types between server and client
- `dist/server.js` - Bundled server for npm distribution
- `bin/pi-deck.js` - CLI entry point

### Key Configuration Files

- `~/.config/pi-deck/config.json` - User config (port, host, etc.)
- `~/.pi/pi-deck-sync.db` - Sync database for workspace state
