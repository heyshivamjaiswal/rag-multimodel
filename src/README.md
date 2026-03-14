## The universal backend pattern: every backend system — RAG, e-commerce, CMS, API — follows the same 5-layer build order. Once you see it, you can build anything.

* Layer 1 — Data shapes
Define what data looks like before writing any logic. If you can't name the inputs and outputs of every layer, you're not ready to code.
 prisma/schema.prisma

* Layer 2 — External connections
Wire up your third-party services and databases. These are the "sockets" your app plugs into. One file per service. All other files import from here.
config.ts
db.ts
 * Layer 3 — Primitives
Small functions that do exactly one thing and depend only on Layer 2. No business logic. No decisions about users or resources. Pure transformation or pure storage.
chunker.ts
vector-store.ts

* Layer 4 — Pipelines
Orchestrate primitives to do real work. Each pipeline = a user-facing action (ingest a PDF, answer a question, delete a resource). Build the simplest pipeline first and get it working end-to-end before adding the others.
ingest/text.ts
rag/chain.ts
ingest/pdf.ts
ingest/link.ts
resources.ts

* Layer 5 — Entry points
Thin files that call pipelines. A demo, an API route, a CLI command. Entry points contain no logic — they just receive input, call the right pipeline, and return output.
users.ts
demo.ts
```
# The rule that makes this work
Dependencies only flow downward. A pipeline imports primitives. Primitives import connections. Connections import config. Nothing imports from a layer above it.

demo.ts    → imports from → ingest/*.ts, rag/chain.ts, resources.ts
ingest/*.ts → imports from → chunker.ts, vector-store.ts, db.ts
rag/chain.ts→ imports from → vector-store.ts, config.ts
chunker.ts  → imports from → config.ts
vector-store → imports from → config.ts
config.ts   → imports from → nothing (root)
db.ts      → imports from → nothing (root)
If you ever find a lower-layer file importing from a higher-layer file, you have a circular dependency waiting to happen. Restructure before it bites you.
```
Apply this pattern to any project
Auth system: schema (User, Session) → config (JWT secret) + db → token utils, password hash → login pipeline, register pipeline → API routes. E-commerce: schema (Product, Order, Cart) → db, stripe client → price calc, inventory check → checkout pipeline, order pipeline → API routes. Same 5 layers, every time.
