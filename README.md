# Auto Present v2
Polytechnic Institute academic management system. DB is system of record (no Sheets).
Single React codebase: Website + Windows app + Android app (Tauri). API: Express + MongoDB.

## Roles (implementation order)
1. Foundation (auth, RBAC, session, CSV import)
2. Super Admin -> 3. Principal -> 4. CI -> 5. Teacher -> 6. Student

Each role: backend -> Windows UI -> Android UI -> owner check -> next role.
