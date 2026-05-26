# Toast Migration Changelog

## Summary
Standardized user notifications across renderer screens using a shared global toast flow:
- `showToast(message, level)` for generic notifications
- `toastAction(action, target?, level?)` for consistent action-format notifications (`action • target`)
- duplicate-toast suppression (same message within 800ms)

All changes pass TypeScript checks.

## New / Updated Core

### `src/renderer/src/components/toast.ts`
- Added duplicate suppression:
  - skips repeated same message within 800ms
- Added helper:
  - `toastAction(action, target?, level = "success")`
  - formats message as: `action • target`

## Screen-level Migration

### Providers
`src/renderer/src/screens/Providers/Providers.tsx`
- Replaced manual `window.dispatchEvent(...)` with `showToast(...)`.
- Added success/error toast for opening Hermes env file.

### App (Global Toast Host)
`src/renderer/src/App.tsx`
- Added global toast event listener (`hermes-toast`) and render stack.
- Added auto-dismiss behavior.

### Gateway
`src/renderer/src/screens/Gateway/Gateway.tsx`
- Added toast feedback for:
  - gateway start/stop
  - platform enable/disable
  - env field save
- Migrated success action messages to `toastAction(...)` where applicable.
- i18n-based toast wording for platform toggle/save.

### Settings
`src/renderer/src/screens/Settings/Settings.tsx`
- Added toast feedback for:
  - migration success/error
  - connection save
  - SSH/Remote connection test success/error
  - switch to local
  - backup/import backup success/error
  - update success/error
  - network save actions
- Replaced hardcoded English toast strings with i18n keys where introduced.

### Agents
`src/renderer/src/screens/Agents/Agents.tsx`
- Added create/delete success/error toast.
- Standardized success messages with `toastAction(...)`.

### Skills
`src/renderer/src/screens/Skills/Skills.tsx`
- Added install/uninstall success/error toast.
- Standardized success messages with `toastAction(...)`.

### Models
`src/renderer/src/screens/Models/Models.tsx`
- Added add/update/delete success toast.
- Includes model name target in success messages.
- Standardized success messages with `toastAction(...)`.

### Schedules
`src/renderer/src/screens/Schedules/Schedules.tsx`
- Added create/delete/pause/resume/run-now success/error toast.
- Success messages include task name (fallback: id/schedule).
- Standardized success messages with `toastAction(...)` (create/delete/run-now).

### Memory
`src/renderer/src/screens/Memory/Memory.tsx`
- Added success/error toast for add/edit/save-profile actions.
- Migrated success actions to `toastAction(...)`.
- Kept error messages via `showToast(msg, "error")`.

### Soul
`src/renderer/src/screens/Soul/Soul.tsx`
- Added success toast for reset action.
- Intentionally no autosave toast to avoid spam.

## i18n Updates

### Provider locale keys (5 locales)
Updated `providers.ts` in:
- `en`, `id`, `es`, `pt-BR`, `zh-CN`

Added keys:
- `missingApiKeys`
- `editEnvFile`
- `openHermesEnv`
- `sshEditEnvHint`
- `openEnvFailed`
- `openEnvSuccess`

### Settings locale keys (5 locales)
Updated `settings.ts` in:
- `en`, `id`, `es`, `pt-BR`, `zh-CN`

Added keys:
- `sshConnected`
- `sshFailed`
- `remoteConnected`
- `remoteFailed`
- `backupCreatedToast`
- `backupFailedToast`

### Gateway locale keys (5 locales)
Updated `gateway.ts` in:
- `en`, `id`, `es`, `pt-BR`, `zh-CN`

Added keys:
- `stateOn`
- `stateOff`
- `platformToggleToast`
- `fieldSavedToast`

## Styling

### `src/renderer/src/assets/main.css`
- Added global toast styles (`.global-toast-*`).

## Validation
Executed:
- `npm run typecheck`

Result:
- success (`typecheck:node` + `typecheck:web` passed)

## Suggested Commit Message
`feat(renderer): standardize global toast UX with i18n + reusable toastAction helper`

## Suggested PR Title
`feat(ui): migrate notifications to global toast system with i18n + dedupe`
