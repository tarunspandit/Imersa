Imersa React UI — Legacy Parity Matrix

Scope
- Map diyHueUI legacy features to new React UI modules.
- Track parity state, gaps, and required API contracts.

Legend
- [x] Parity achieved
- [~] Partial parity (minor gaps)
- [ ] Not implemented / needs work

Core
- [x] Auth: `/get-key` retrieval, local storage
- [x] Static serving + routing from Flask
- [x] React build pipeline passing

Lights (`/ui/lights`)
- [x] List/refresh lights
- [x] On/off, bulk all on/off via `/groups/0/action`
- [x] Brightness with debounce (120ms)
- [x] Color temperature with debounce (150ms)
- [x] Hue/saturation (where supported)
- [x] Rename, delete
- [x] Light type mapping via `/light-types` GET/POST
- [~] Error toasts and retry UX (improve)

Groups (`/ui/groups`)
- [x] List groups (exclude id `0`)
- [x] Toggle group on/off via `/groups/{id}/action`
- [x] Entertainment start/stop via `/groups/{id}` `{ stream: { active } }`
- [x] Group detail summary; membership add/remove
- [~] Full group edit parity (room/zone forms) — refine

Scenes (`/ui/scenes`)
- [x] List scenes with type/group
- [x] Create from current (POST `/scenes`), group selector
- [x] Rename, delete, recall (PUT `/groups/{g}/action {scene}`)
- [~] Advanced metadata (palette, transitions) — backlog

Entertainment (`/ui/entertainment` + Wizard)
- [x] List Entertainment groups with status
- [x] Start/stop streaming
- [x] Load/edit/save positions (PUT locations)
- [~] Wizard happy-path (positions templates) — refine + WS live updates

Sensors (`/ui/sensors`)
- [~] List, filters, config modal UI
- [ ] Wire API CRUD for config/thresholds to bridge endpoints

Rules (`/ui/automation`)
- [~] List, enable/disable, delete
- [~] RuleBuilder: create/edit; apply templates (wire remaining handlers)

Schedules (`/ui/schedules`)
- [ ] List/create/delete schedules; map to REST

Devices (`/ui/devices`)
- [~] Basic list; refine parity with legacy

Vendor Settings
- [x] WLED settings (GET)
- [x] Yeelight settings (GET/POST)
- [ ] Yeelight page alignment with `useYeelight` (deferred)

Error Pages
- [x] 403/404/500 via React + Flask error handlers

Testing
- [x] Jest unit and integration passing
- [~] Cypress E2E for lights/groups/scenes/entertainment
- [ ] Extend E2E to schedules/sensors/rules/settings

Notes
- Yeelight page is deferred for alignment; bridge JSON endpoints are live.
- WebSocket real-time updates are planned for entertainment/rules.
