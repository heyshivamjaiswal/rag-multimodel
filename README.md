
## Goal when reading: trace how data transforms. Every file receives something, does one job, and passes something forward. Follow the data shape, not the file name.

* 1 prisma/schema.prisma
data shapes
Start here before any .ts file. Understand what two things are stored in Postgres (User and Resource) and why everything else in the codebase exists to create, read, or delete those rows.

* 2 config.ts
infra
Read this second. It creates the three clients the whole app depends on: OpenAI embeddings, OpenAI chat LLM, and Pinecone. Every other file imports FROM here.

* 3 db.ts
infra
Tiny file, important concept. One PrismaClient instance shared by the whole app. Read it to understand the singleton pattern — you'll use this in every backend you ever build.

* 4 chunker.ts
primitive
First real logic file. One function: chunkText(text, metadata) → Document[]. Read it to understand how LangChain's splitter works and why overlap exists.

* 5 vector-store.ts
primitive
Four functions that wrap Pinecone. Read this to understand how per-user namespace isolation works — this is the key architectural decision of the whole project.

* 6 ingest/text.ts
pipeline
Read this before pdf.ts or link.ts — it's the simplest pipeline. No parsing. Just 4 steps: validate → create Postgres row → chunkText() → addDocumentsForUser(). The other two ingest files follow the same 4-step pattern.

* 7 rag/chain.ts
pipeline
The payoff file. Read queryKnowledgeBase() line by line — it's only 5 steps but everything in the project exists to support them. Also read buildSystemPrompt() carefully.

* 8 ingest/pdf.ts
pipeline
Same 4-step pattern as text.ts, but with an extraction step prepended: pdf-parse extracts raw text from a Buffer, then the rest is identical. Once you see the pattern, this file is just 'text.ts + one line'.

* 9 ingest/link.ts
pipeline
Same pattern again, but with two prepended steps: axios fetches HTML, Cheerio extracts clean text. Read extractTextFromHTML() to understand how Cheerio works.
  
* 10 resources.ts
pipeline
CRUD layer for the 'My Library' feature. Read deleteResource() most carefully — it shows the two-store delete problem: you must remove from Pinecone AND Postgres.

* 11 demo.ts
entry point
Read last. Not as a code file — read it as a test suite. Every ingest function call is a test. The 'Alice asking about Bob's data' queries are your isolation tests. The 'out-of-scope question' is your grounding test.



## Goal when building: get a working end-to-end path as fast as possible, even if it's rough. Then upgrade each layer. Never build features you can't test yet.


* 1 prisma/schema.prisma
layer 1 — data shapes
Write this before any TypeScript. Drawing the data model forces you to answer: what are the nouns in my system? You cannot write a single function until you know what data it operates on.

* 2 config.ts
layer 2 — connections
Second file, always. Wire up your external services. Everything else in the app imports from this file. If a key is wrong you find out immediately, not 10 files deep.

* 3 db.ts
layer 2 — connections
Three lines. Just export a PrismaClient singleton. Don't add any logic here. Test it by importing and running db.user.findMany() — if it doesn't throw, Postgres is connected.

* 4 chunker.ts
layer 3 — primitives
First primitive. Takes text, returns Document[]. No database. No Pinecone. Pure transformation. Test it immediately by passing a long string and printing the chunks.

* 5 vector-store.ts
layer 3 — primitives
Second primitive. Write addDocumentsForUser and searchUserStore first. Get two test vectors into Pinecone and search them before writing any ingestion code.

* 6 ingest/text.ts
layer 4 — first pipeline
CRITICAL STEP: build the simplest ingestion pipeline first and get the full E2E path working. Do not build pdf.ts or link.ts yet. Text → chunks → Pinecone → Postgres → query back. That loop is the entire system.

* 7 rag/chain.ts
layer 4 — core pipeline
Build this immediately after text.ts works. Don't add pdf.ts or link.ts yet. Your goal is a working end-to-end answer: ingest text → ask question → get grounded answer. That's the whole product.

* 8 ingest/pdf.ts
layer 4 — pipeline
Now add PDF support. Copy text.ts, add pdfParse(buffer) at the top. The rest is identical. If you wrote text.ts cleanly, this file writes itself in 10 minutes.

* 9 ingest/link.ts
layer 4 — pipeline
Add link scraping last — it's the most complex parser. Copy text.ts, add extractTextFromHTML() at the top. The scraping is the only new part; the ingestion pipeline is the same.

* 10 resources.ts + users.ts
layer 4 — CRUD
Add resource management once ingestion and querying work. listUserResources() and deleteResource() are the two functions that matter. Users.ts is just findOrCreateUser — three lines.

* 11 demo.ts
layer 5 — entry point
Write demo.ts last. It's not application logic — it's a test script. Write it to prove every feature works: two users, isolation between them, ingest each type, query, delete. If demo.ts runs clean, the app is done.
