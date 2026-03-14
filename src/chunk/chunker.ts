// ─────────────────────────────────────────────────────────────────────────────
// chunker.ts  —  Splits text into smaller pieces before embedding
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY WE CHUNK
// ────────────
// An embedding model represents a piece of text as a single vector.
// If you embed a 50-page PDF as one vector, you lose all granularity.
// "What is on page 34?" can't be answered because everything is averaged together.
//
// By splitting into small chunks first, each chunk gets its own vector,
// and we can retrieve exactly the right paragraphs for any question.
//
// HOW LANGCHAIN'S SPLITTER WORKS
// ───────────────────────────────
// RecursiveCharacterTextSplitter tries to split at natural boundaries:
//   1st try: split at double newline  (paragraph break)
//   2nd try: split at single newline  (line break)
//   3rd try: split at period/sentence (sentence boundary)
//   4th try: split at space           (word boundary)
//   last try: split at any character  (fallback)
//
// It stops at the first option that keeps the chunk under chunkSize.
// This preserves natural sentence/paragraph boundaries wherever possible.
//
// OVERLAP
// ────────
// chunkOverlap = 200 means each chunk shares 200 characters with the next.
// This prevents context loss at chunk boundaries.
//
// Example with overlap=5 (simplified):
//   text: "the cat sat on the mat"
//   chunk 1: "the cat sat"
//   chunk 2: "t on the mat"   ← shares "t on" from end of chunk 1

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { CHUNK_SIZE, CHUNK_OVERLAP } from './config';

// Create the splitter once (it's stateless, safe to reuse)
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

// ── The main function: text → Document[] ─────────────────────────────────────
//
// metadata is extra info that travels with every chunk.
// We store: resourceId, userId, source, title, type
// This metadata ends up in Pinecone alongside each vector,
// so we can always trace back where a chunk came from.
export async function chunkText(
  text: string,
  metadata: Record<string, string>
): Promise<Document[]> {
  // splitDocuments takes a list of Documents and splits them
  // We wrap our text in one Document first
  const rawDoc = new Document({
    pageContent: text,
    metadata: metadata,
  });

  const chunks = await splitter.splitDocuments([rawDoc]);

  // Add the chunk index to each piece so we know the order
  chunks.forEach((chunk, index) => {
    chunk.metadata.chunkIndex = String(index);
    chunk.metadata.totalChunks = String(chunks.length);
  });

  console.log(
    `  Split into ${chunks.length} chunks ` +
      `(avg ${Math.round(text.length / chunks.length)} chars each)`
  );

  return chunks;
}
