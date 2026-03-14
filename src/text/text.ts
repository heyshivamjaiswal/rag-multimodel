// ─────────────────────────────────────────────────────────────────────────────
// ingest/text.ts  —  Ingest a plain text snippet into a user's knowledge base
// ─────────────────────────────────────────────────────────────────────────────
//
// The simplest ingestion type: user pastes or types some text directly.
// No parsing needed — just chunk, embed, store.
//
// Good for: notes, meeting summaries, copied articles, manual knowledge entries.

import db from '../db';
import { chunkText } from '../chunker';
import { addDocumentsForUser } from '../vector-store';

// ── Main function ─────────────────────────────────────────────────────────────
//
// userId  - who is adding this
// title   - a label for the text, e.g. "Meeting notes 2024-01-15"
// content - the actual text content
export async function ingestText(
  userId: string,
  title: string,
  content: string
): Promise<{ resourceId: string; chunkCount: number }> {
  console.log(`\n📝 Ingesting text: "${title}" for user ${userId}`);

  if (!content || content.trim().length === 0) {
    throw new Error('Text content cannot be empty');
  }

  if (content.trim().length < 50) {
    throw new Error('Text is too short to be useful (minimum 50 characters)');
  }

  // ── Step 1: Save to Postgres ──────────────────────────────────────────────
  const resource = await db.resource.create({
    data: {
      userId: userId,
      title: title,
      type: 'TEXT',
      chunkCount: 0,
    },
  });

  // ── Step 2: Chunk, embed, store in Pinecone ───────────────────────────────
  const chunks = await chunkText(content, {
    resourceId: resource.id,
    userId: userId,
    source: `text:${resource.id}`,
    title: title,
    type: 'TEXT',
  });

  await addDocumentsForUser(userId, chunks);

  await db.resource.update({
    where: { id: resource.id },
    data: { chunkCount: chunks.length },
  });

  console.log(`  ✅ Text ingested: "${title}" → ${chunks.length} chunks`);

  return { resourceId: resource.id, chunkCount: chunks.length };
}
