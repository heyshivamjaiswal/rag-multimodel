// ─────────────────────────────────────────────────────────────────────────────
// rag/chain.ts  —  The heart of the system: retrieval + grounded generation
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW THIS WORKS (step by step):
//
//  1. User asks a question: "What is the refund policy?"
//
//  2. RETRIEVAL:
//     - We embed the question into a vector using OpenAI
//     - We search the user's Pinecone namespace for the most similar chunks
//     - We get back e.g. 5 text chunks that semantically match the question
//
//  3. CONTEXT BUILDING:
//     - We format those 5 chunks into a readable block with source labels
//     - This becomes the "context" for the LLM
//
//  4. GENERATION (grounded):
//     - We send the context + question to GPT-4o-mini
//     - The system prompt says: ONLY answer from the context, cite sources
//     - The LLM produces a grounded answer with citations
//
//  5. RESULT:
//     - We return the answer + which sources it used
//
// WHY NOT USE LANGCHAIN'S BUILT-IN RetrievalQAChain?
// ────────────────────────────────────────────────────
// The built-in chain is convenient but hides what's happening.
// Writing it manually makes each step visible and easy to customise.
// This is much better for learning and for debugging.

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Document } from '@langchain/core/documents';
import { llm } from '../config';
import { searchUserStore } from '../vector-store';

// ── What we return after a query ─────────────────────────────────────────────
export type QueryResult = {
  answer: string;
  sources: Source[];
  chunkCount: number; // how many chunks were used
};

export type Source = {
  title: string;
  type: string; // "PDF", "LINK", "TEXT"
  sourceUrl: string | undefined;
  resourceId: string;
};

// ── Build the context block from retrieved chunks ────────────────────────────
// This is what gets inserted into the LLM prompt.
// Each chunk is labelled with its source so the LLM can cite it.
function buildContextBlock(chunks: Document[]): string {
  return chunks
    .map((chunk, index) => {
      const src = chunk.metadata.title || chunk.metadata.source || 'Unknown';
      const type = chunk.metadata.type || '';
      return (
        `[SOURCE ${index + 1}: ${src} (${type})]\n` +
        `${chunk.pageContent}\n` +
        `[END SOURCE ${index + 1}]`
      );
    })
    .join('\n\n');
}

// ── The grounding system prompt ───────────────────────────────────────────────
// This is the most important prompt in the system.
// It instructs the LLM to ONLY use the provided context.
const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based ONLY on the provided context.

RULES:
1. Only use information from the context provided. Do not use any outside knowledge.
2. When you use information from a source, cite it like this: [SOURCE 1], [SOURCE 2], etc.
3. If the context does not contain enough information to answer the question, say:
   "I couldn't find relevant information in your knowledge base to answer this question."
4. Do not make up, guess, or invent information.
5. Keep your answer clear and concise.`;

// ── Main query function ───────────────────────────────────────────────────────
//
// userId   - whose knowledge base to search
// question - the user's natural language question
// topK     - how many chunks to retrieve (default 5)
export async function queryKnowledgeBase(
  userId: string,
  question: string,
  topK: number = 5
): Promise<QueryResult> {
  console.log(`\n🔍 Query from user ${userId}: "${question}"`);

  // ── Step 1: Retrieve relevant chunks from Pinecone ───────────────────────
  const retrievedChunks = await searchUserStore(userId, question, topK);

  console.log(`  Retrieved ${retrievedChunks.length} chunks from Pinecone`);

  if (retrievedChunks.length === 0) {
    return {
      answer: 'Your knowledge base is empty. Please add some documents first.',
      sources: [],
      chunkCount: 0,
    };
  }

  // ── Step 2: Build the context block ──────────────────────────────────────
  const contextBlock = buildContextBlock(retrievedChunks);

  // ── Step 3: Build the prompt ──────────────────────────────────────────────
  // We send two messages:
  //   SystemMessage = instructions for the LLM (the rules)
  //   HumanMessage  = the context + question
  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(
      `CONTEXT:\n\n${contextBlock}\n\n` + `QUESTION: ${question}`
    ),
  ];

  // ── Step 4: Call the LLM ─────────────────────────────────────────────────
  const response = await llm.invoke(messages);

  // response.content is the LLM's answer text
  const answer =
    typeof response.content === 'string'
      ? response.content
      : String(response.content);

  // ── Step 5: Extract unique sources from the retrieved chunks ─────────────
  // Build a deduplicated list of sources that were searched
  const sourceMap = new Map<string, Source>();

  retrievedChunks.forEach((chunk) => {
    const rid = chunk.metadata.resourceId;
    if (rid && !sourceMap.has(rid)) {
      sourceMap.set(rid, {
        title: chunk.metadata.title || 'Untitled',
        type: chunk.metadata.type || 'UNKNOWN',
        sourceUrl: chunk.metadata.sourceUrl,
        resourceId: rid,
      });
    }
  });

  const sources = Array.from(sourceMap.values());

  console.log(`  ✅ Answer generated using ${sources.length} source(s)`);

  return { answer, sources, chunkCount: retrievedChunks.length };
}
