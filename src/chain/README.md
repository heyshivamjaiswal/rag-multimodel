* 1. Function Inputs
```
ts
export async function queryKnowledgeBase(
  userId: string,
  question: string,
  topK: number = 5
)
```
Inputs:

userId → ensures we search only this user’s namespace in Pinecone.

question → the natural language query from the user.

topK → how many chunks to retrieve (default 5).

Link: These values drive the retrieval step (searchUserStore) and shape the prompt sent to the LLM.

* 2. Retrieve Relevant Chunks
```
ts
const retrievedChunks = await searchUserStore(userId, question, topK);
Purpose: Calls your earlier searchUserStore function.
```
Link:

Embeds the query → finds top K nearest vectors in Pinecone → returns them as Document[].

These chunks are the context the LLM will use to answer the question.

* 3. Handle Empty Knowledge Base
```
ts
if (retrievedChunks.length === 0) {
  return {
    answer: "Your knowledge base is empty. Please add some documents first.",
    sources: [],
    chunkCount: 0,
  };
}
Purpose: Gracefully handles the case where no chunks exist.
```
Link: Prevents sending an empty context to the LLM, which would cause hallucinations.

* 4. Build Context Block
```
ts
const contextBlock = buildContextBlock(retrievedChunks);
Purpose: Calls buildContextBlock, which formats chunks into labeled sections like:
```
Code
[SOURCE 1: Meeting Notes (TEXT)]
<chunk text>
[END SOURCE 1]
Link:

This structure is inserted into the LLM prompt.

Ensures the LLM knows exactly which source each piece of text came from, enabling citations.

* 5. Build Prompt Messages
```
ts
const messages = [
  new SystemMessage(SYSTEM_PROMPT),
  new HumanMessage(
    `CONTEXT:\n\n${contextBlock}\n\n` +
    `QUESTION: ${question}`
  ),
];
Purpose: Creates the two-part prompt:
```
SystemMessage → rules for the LLM (only use context, cite sources, don’t invent).

HumanMessage → actual context + user’s question.

Link: This prompt structure enforces grounding — the LLM cannot wander outside the retrieved chunks.

* 6. Call the LLM
```
ts
const response = await llm.invoke(messages);
Purpose: Sends the prompt to your configured LLM.
```
Link: The LLM generates an answer based only on the provided context block.

* 7. Extract Answer
```
ts
const answer = typeof response.content === "string"
  ? response.content
  : String(response.content);
Purpose: Normalizes the LLM’s output into a string.
```
Link: This becomes the answer field in the final QueryResult.

* 8. Deduplicate Sources
```
ts
const sourceMap = new Map<string, Source>();

retrievedChunks.forEach((chunk) => {
  const rid = chunk.metadata.resourceId;
  if (rid && !sourceMap.has(rid)) {
    sourceMap.set(rid, {
      title:      chunk.metadata.title      || "Untitled",
      type:       chunk.metadata.type       || "UNKNOWN",
      sourceUrl:  chunk.metadata.sourceUrl,
      resourceId: rid,
    });
  }
});
Purpose: Builds a unique list of sources from the retrieved chunks.
```
Link:

Prevents duplicate citations if multiple chunks came from the same resource.

Each source includes title, type, sourceUrl, and resourceId.

This ties back to the metadata you attached during ingestion.

* 9. Return Final Result
```
ts
return { answer, sources, chunkCount: retrievedChunks.length };
Purpose: Returns a structured QueryResult.
```
Link:

answer → the LLM’s grounded response.

sources → deduplicated list of resources used.

chunkCount → how many chunks were retrieved.

🔗 Full Flow Connection
User asks a question → queryKnowledgeBase starts.

Retrieve chunks → searchUserStore pulls top K from Pinecone.

Format context → buildContextBlock labels chunks with sources.

Build prompt → SystemMessage (rules) + HumanMessage (context + question).

LLM invoked → generates grounded answer.

Sources deduplicated → ensures clean citation list.

Return result → answer + sources + chunk count.
