// ─────────────────────────────────────────────────────────────────────────────
// ingest/pdf.ts  —  Ingest a PDF file into a user's knowledge base
// ─────────────────────────────────────────────────────────────────────────────
//
// FLOW:
//   PDF file (Buffer)
//     → extract all text with pdf-parse
//     → split into chunks with LangChain splitter
//     → embed each chunk with OpenAI
//     → store vectors in user's Pinecone namespace
//     → save resource metadata in PostgreSQL
//     → return the created Resource record

import pdfParse from 'pdf-parse';
import db from '../db';
import { chunkText } from '../chunker';
import { addDocumentsForUser } from '../vector-store';

// ── Main function ─────────────────────────────────────────────────────────────
//
// userId     - who is uploading (their Postgres id)
// fileName   - display name, e.g. "React-handbook.pdf"
// fileBuffer - the raw PDF bytes (from fs.readFile or a file upload)
export async function ingestPDF(
  userId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ resourceId: string; chunkCount: number }> {
  console.log(`\n📄 Ingesting PDF: "${fileName}" for user ${userId}`);

  // ── Step 1: Extract text from the PDF ────────────────────────────────────
  // pdf-parse reads the buffer and gives us all the text
  const pdfData = await pdfParse(fileBuffer);
  const rawText = pdfData.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      'PDF appears to be empty or contains only images (no extractable text)'
    );
  }

  console.log(
    `  Extracted ${rawText.length} characters from ${pdfData.numpages} pages`
  );

  // ── Step 2: Create the resource record in Postgres ────────────────────────
  // We create this BEFORE indexing so we have the resourceId for the metadata
  const resource = await db.resource.create({
    data: {
      userId: userId,
      title: fileName,
      type: 'PDF',
      chunkCount: 0, // will update after indexing
    },
  });

  console.log(`  Created resource record: ${resource.id}`);

  // ── Step 3: Split text into chunks ───────────────────────────────────────
  // The metadata we pass here will be stored with EVERY vector in Pinecone
  // This lets us trace any retrieved chunk back to its source
  const chunks = await chunkText(rawText, {
    resourceId: resource.id,
    userId: userId,
    source: fileName,
    title: fileName,
    type: 'PDF',
  });

  // ── Step 4: Embed chunks and store in Pinecone ───────────────────────────
  // addDocumentsForUser calls OpenAI to embed and then stores in Pinecone
  await addDocumentsForUser(userId, chunks);

  // ── Step 5: Update the chunk count in Postgres ───────────────────────────
  await db.resource.update({
    where: { id: resource.id },
    data: { chunkCount: chunks.length },
  });

  console.log(`  ✅ PDF ingested: ${chunks.length} chunks stored`);

  return { resourceId: resource.id, chunkCount: chunks.length };
}
