Imersa UI Migration

Overview
- This repository now includes a new server-rendered UI (SSR) that replaces the legacy hash-based SPA.
- Entry point: `/ui`. Pages are under `/ui/*` with direct routes.

Routes
- `/ui` — landing page
- `/ui/lights` — list and control lights
- `/ui/groups` — list and control groups
- `/ui/scenes` — list, create, recall, delete scenes
- `/ui/schedules` — list, create, delete schedules
- `/ui/sensors` — sensor list and states
- `/ui/rules` — list, enable/disable, delete rules
- `/ui/settings` — bridge config, updates, system tools
- `/ui/entertainment` — entertainment areas list and editor
- `/entertainment-wizard` — guided entertainment area creation
- `/wled-settings`, `/yeelight-settings` — vendor-specific settings

Hash redirects
- The nav template includes a client-side mapper to redirect known hash routes
  like `/#lights` to their SSR equivalents (e.g., `/ui/lights`).

Security
- Existing REST API auth semantics remain: UI fetches `/get-key` to use a local API user.
- To require login for specific pages, decorate routes in `flaskUI/core/views.py` with `@flask_login.login_required`.

Maintenance
- Old SPA assets are no longer required; shared fonts and images remain.
- If removing legacy assets, keep `flaskUI/assets/fontawesome*` and `flaskUI/assets/images`.

