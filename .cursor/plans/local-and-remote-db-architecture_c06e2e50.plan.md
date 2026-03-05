---
name: local-and-remote-db-architecture
overview: Outline options and a recommended approach to evolve the existing local-only app into one that can also work with a remote database over the internet while still supporting local/offline use.
todos:
  - id: identify-db-access-points
    content: List all existing database access points and operations in the main process and how renderer pages currently call them.
    status: pending
  - id: design-data-service-interface
    content: Design a clean IDataService interface that covers items, units, invoices, and settings operations.
    status: pending
  - id: draft-backend-api-contract
    content: Sketch a simple REST or GraphQL API contract that matches the IDataService methods and maps to a central server database schema.
    status: pending
  - id: plan-offline-sync-mechanics
    content: Define how the local cache/outbox tables, sync loop, and conflict-resolution strategy will work for write operations.
    status: pending
isProject: false
---

### Goal

Design how the current local-only desktop app can later support using a remote database over the internet, while still working fully offline on a local database.

### High-level options

- **Option 1 – Direct remote DB connection from app**
  - App connects straight to a remote SQL/NoSQL database (e.g. PostgreSQL, MySQL, MongoDB) over the internet using its client drivers.
  - **Pros**:
    - Simpler conceptual model (app “just talks to DB”).
    - Potentially lower latency per query if you colocate DB close to users and avoid extra API hops.
  - **Cons**:
    - Hard to secure: you must expose DB ports to the internet or via VPN; credentials live on every client.
    - Very hard to evolve schema and do migrations safely when many app versions talk directly to DB.
    - No natural place for business logic, access control, audit logging, rate limiting, etc.
    - Offline mode becomes complex: you would need a second local DB plus a custom sync engine.
  - **Fit for you**:
    - Not recommended for this project; security and maintenance risk is high, and it does not align well with future multi-client/remote usage.
- **Option 2 – Local DB plus custom sync with remote DB**
  - Keep the current local DB (likely SQLite) as the primary store for the app.
  - Introduce a remote server (API + its own DB) and implement a custom sync protocol (change tracking, conflict resolution) between local and remote.
  - **Pros**:
    - Strong offline-first story; app always reads/writes local DB.
    - Remote server can centralize business rules, user accounts, permissions, reporting, etc.
    - Server can use a robust DB (PostgreSQL, MySQL, etc.) independent of the desktop’s local DB.
  - **Cons**:
    - Sync is non‑trivial: need per-record versioning, conflict rules, handling deletes, partial sync, and error recovery.
    - Requires backend infrastructure and monitoring.
  - **Fit for you**:
    - Good long‑term choice if you need many distributed clients that work offline and occasionally sync to a central system.
- **Option 3 – Local DB but all writes/reads go through a remote HTTP/GraphQL API when online**
  - Introduce a backend API (Node, NestJS, Fastify, etc.) with its own DB; the Electron app calls the API instead of talking directly to a remote DB.
  - Local DB is used as a cache or offline replica; when offline the app writes to local DB and queues changes to send when back online.
  - **Pros**:
    - Clear separation of concerns: client (Electron) vs server (API + DB).
    - Security: DB is never exposed directly; API can handle auth, RBAC, validation, rate limiting, and auditing.
    - Easier schema evolution: only the API talks to the DB and shields clients from internal changes.
    - Compatible with future non-Electron clients (web app, mobile, other services) using the same API.
  - **Cons**:
    - Need to design an API and change app to go through it.
    - Requires designing offline sync/queueing logic: which operations can be queued, how to handle conflicts, etc.
  - **Fit for you**:
    - Generally the best trade‑off for "works locally" and "works over the internet" with good security and a path to more clients.
- **Option 4 – Use an offline‑first replication framework (e.g. RxDB, PouchDB/CouchDB, Supabase/Replicache‑style)**
  - Replace or wrap the local DB with a library that has built‑in sync with a remote endpoint (e.g. RxDB + its sync server, PouchDB <-> CouchDB, or a hosted backend that offers client replication SDKs).
  - **Pros**:
    - A lot of replication complexity (change tracking, conflicts) is handled by the library.
    - Often reactive APIs that fit well with modern frontends.
  - **Cons**:
    - Requires aligning your schema and patterns with the library; less flexibility than a custom protocol.
    - Ties you to the ecosystem and its maturity; migration away later can be expensive.
    - May be overkill if your domain is simple and number of clients is modest.
  - **Fit for you**:
    - Worth considering if you want sync now and are happy to adopt the chosen ecosystem’s patterns.

### Recommended direction for this app

- **Primary recommendation**: Move towards **Option 3** (Electron client + HTTP/GraphQL API server + server DB), keeping your current local DB as an **offline cache plus write‑ahead queue**.
  - Server side:
    - Create a small backend service (Node/Express/NestJS/Fastify) with a central relational DB (PostgreSQL is a strong default).
    - Expose versioned REST or GraphQL endpoints for the main entities you already have in `src/main/db` (items, units, invoices, settings, etc.).
    - Implement authentication (initially even a shared API key or per‑client token; later user accounts/roles).
  - Client side (Electron):
    - Abstract DB access behind a `DataSource` interface in the main process: e.g. `LocalDataSource` (SQLite) and `RemoteDataSource` (HTTP API with local cache).
    - Add a configuration option in Settings to choose "Local only" vs "Remote server" (with URL and credentials) and store it in your existing settings store.
    - For remote mode:
      - Reads: Prefer server data when online; cache results into local DB for speed/offline viewing.
      - Writes: When online, send to server and also update local DB; when offline, write to local DB with an "outbox" table that queues pending operations.
      - Background sync process (in main process) regularly flushes the outbox to the API and reconciles state.
    - Ensure that all renderer pages (`Items`, `Invoices`, etc.) talk only to this abstraction via IPC, not directly to SQLite or HTTP.

### Concrete design elements

- **Configuration & connection modes**
  - Add a `connectionMode` setting: `"local" | "remote"`.
  - When `remote`, also configure `apiBaseUrl`, `apiKey`/`token`, and maybe company/site ID.
  - On startup, main process reads this setting and initializes the appropriate data source.
- **Data access abstraction**
  - Define an interface like `IDataService` with methods already aligned with your current queries:
    - `getItems`, `upsertItem`, `deleteItem`, `getInvoices`, `upsertInvoice`, `getUnits`, `getSettings`, etc.
  - Implement:
    - `LocalDataService` that calls your existing `db` (SQLite) code only.
    - `RemoteDataService` that calls the HTTP API and also mirrors to a local SQLite cache/outbox.
  - Expose a single instance to renderer via preload IPC so UI does not care whether the app is local or remote.
- **Offline & sync strategy**
  - Introduce an `operations_outbox` table in the local DB with columns like `id`, `entityType`, `entityId`, `operationType` (create/update/delete), `payload`, `createdAt`, `status`.
  - When in remote mode:
    - All mutating actions write into local DB and also append an outbox record; if online, immediately push to server and mark as synced.
    - A background timer/worker in main process periodically tries to send unsynced records, with exponential backoff.
    - For conflict handling, start with a simple rule such as **last write wins by timestamp** or **server authority** and evolve later as needed.
- **Security considerations**
  - Never expose your remote database directly; keep it on a private network and only expose the API.
  - Store API credentials encrypted (or at least obfuscated) on disk in the app, and prefer per-user/per-install tokens over a global DB password.
  - Use HTTPS for all traffic and validate certificates.
  - Plan for basic rate limiting and authentication on the server so that, later, many clients can safely connect.
- **Migration path from current code**
  - Step 1: Identify all direct DB access points in `src/main/db` and wrap them into a clean service (`LocalDataService`). Ensure renderer code calls only into this service via IPC.
  - Step 2: Introduce the `IDataService` interface and refactor `LocalDataService` to implement it.
  - Step 3: Implement `RemoteDataService` that talks to a mocked or early-stage API server; add the Settings toggle and wiring to switch services.
  - Step 4: Add local caching/outbox tables and the background sync loop.
  - Step 5: Harden error handling, retry logic, and add simple conflict rules and logging.

### Pros and cons of the recommended approach

- **Pros**
  - Works well both fully offline (local only) and online (remote mode with caching and sync).
  - Scales to many clients and future platforms reusing the same HTTP/GraphQL API.
  - Keeps your existing local DB investment while adding a clean, secure path to remote operation.
  - Clear layering: UI → IPC → data service → (local DB or API + local cache).
- **Cons / trade‑offs**
  - Requires building and operating a backend service.
  - Need to design and maintain sync semantics and conflict rules.
  - Slightly more complex app startup and configuration logic.

### Summary

For a system that must "work in local and over the internet" and later support many clients, the best general pattern is **Electron client with a clear data-service abstraction plus a central HTTP/GraphQL API server with its own DB**, using your local DB for offline capability and caching. The alternatives (direct DB over the internet or ad‑hoc sync) are either insecure or harder to evolve at scale. Once you confirm this direction, we can define concrete types, endpoints, and a step-by-step refactor plan tailored to your current `src/main/db` and renderer pages.
