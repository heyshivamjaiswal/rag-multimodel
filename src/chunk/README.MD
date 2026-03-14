* 1. Text Splitter Setup
```
ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

```
Purpose: Defines how the text will be broken into smaller pieces.

chunkSize: Maximum length of each chunk (e.g., 500–1000 characters).

chunkOverlap: Ensures chunks overlap slightly so context isn’t lost at boundaries.

Reason: LLMs and vector databases work better with smaller, context-preserving chunks rather than huge blocks of text.


* 2. Function Declaration
```
ts
export async function chunkText(
  text: string,
  metadata: Record<string, string>
): Promise<Document[]> {
```
Purpose: This is the main function that takes raw text and metadata, then returns an array of Document objects.

Reason: Wrapping text + metadata into Document[] makes it ready for embedding and storage in Pinecone (or other vector DBs).

* 3. Wrap Text in a Document
```
ts
const rawDoc = new Document({
  pageContent: text,
  metadata: metadata,
});

```
Purpose: Creates a single Document object containing the entire text and its metadata.

Reason: splitDocuments expects a list of Documents, not raw strings. Metadata (like resourceId, userId, source, etc.) is attached here so it travels with every chunk.

* 4. Split into Chunks
```
ts
const chunks = await splitter.splitDocuments([rawDoc]);
Purpose: Uses the RecursiveCharacterTextSplitter to break the big Document into smaller chunks.
```

Reason: Smaller chunks improve retrieval precision and reduce token usage when passing context to the LLM.

 * 5. Add Chunk Index Metadata
```
ts
chunks.forEach((chunk, index) => {
  chunk.metadata.chunkIndex = String(index);
  chunk.metadata.totalChunks = String(chunks.length);
});
```
Purpose: Adds two extra metadata fields to each chunk:

chunkIndex: The position of the chunk in the sequence.

totalChunks: The total number of chunks created.

Reason:

Helps reconstruct the original order if needed.

Useful for debugging, pagination, or reassembling context.

Ensures traceability — you know exactly where each chunk came from.
