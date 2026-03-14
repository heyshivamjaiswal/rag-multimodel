# Interacting with vector database

* 1. Adding Documents for a User
```
ts
export async function addDocumentsForUser(
  userId: string,
  documents: Document[]
): Promise<string[]> {
  const store = await getVectorStore(userId);

  // addDocuments embeds each document and upserts them into Pinecone
  const ids = await store.addDocuments(documents);

  console.log(`  Stored ${ids.length} vectors in namespace "${userId}"`);
  return ids;
}
```
Purpose: Takes a user’s documents (already chunked + metadata) and stores them in Pinecone.

Steps:

getVectorStore(userId) → retrieves the Pinecone namespace for this user. Each user has their own “bucket” so data doesn’t mix.

store.addDocuments(documents) → embeds each document (turns text into vectors) and inserts them into Pinecone.

console.log(...) → confirms how many vectors were stored and where.

return ids → returns the unique IDs of the stored vectors (important for later deletion).

👉 Reason: This ensures every user’s data is isolated and traceable, and you can later delete or query by ID.

* 2. Searching a User’s Store
```
ts
export async function searchUserStore(
  userId: string,
  query: string,
  topK: number = 5
): Promise<Document[]> {
  const store = await getVectorStore(userId);

  // similaritySearch:
  //  1. embeds the query string into a vector
  //  2. finds the K nearest vectors in this user's namespace
  //  3. returns those as Document objects
  const results = await store.similaritySearch(query, topK);

  return results;
}
```
Purpose: Finds the most relevant chunks for a user’s query.

Steps:

getVectorStore(userId) → again, ensures we’re searching only this user’s namespace.

similaritySearch(query, topK) →

Embeds the query into a vector.

Finds the top K closest vectors (chunks) in Pinecone.

Returns them as Document objects (with text + metadata).

return results → gives back the most relevant chunks.

👉 Reason: This is the retrieval step in RAG. It ensures the LLM gets the right context chunks to answer the query.

* 3. Deleting Vectors for a Resource
```
ts
export async function deleteVectorsForResource(
  userId: string,
  vectorIds: string[]
): Promise<void> {
  if (vectorIds.length === 0) return;

  const index = pineconeClient.index(PINECONE_INDEX_NAME);
  const namespacedIndex = index.namespace(userId);

  await namespacedIndex.deleteMany(vectorIds);

  console.log(`  Deleted ${vectorIds.length} vectors from namespace "${userId}"`);
}
```
Purpose: Removes vectors when a user deletes a resource (e.g., a document).

Steps:

if (vectorIds.length === 0) return; → quick exit if nothing to delete.

pineconeClient.index(PINECONE_INDEX_NAME) → connects to the Pinecone index.

.namespace(userId) → ensures deletion happens only in this user’s namespace.

deleteMany(vectorIds) → deletes the specific vectors by ID.

console.log(...) → confirms how many vectors were deleted.

👉 Reason: Pinecone free tier doesn’t allow deletion by metadata, so you must track vector IDs (usually stored in Postgres or another DB). This guarantees precise deletion.

 Big Picture
addDocumentsForUser → Ingest chunks + metadata into Pinecone.

searchUserStore → Retrieve the most relevant chunks for a query.

deleteVectorsForResource → Clean up vectors when a resource is removed.

Together, these functions give you a full lifecycle:
Add → Search → Delete, all scoped to a user’s namespace so data stays isolated and manageable.
