// ─────────────────────────────────────────────────────────────────────────────
// resources.ts  —  CRUD operations for a user's knowledge base resources
// ─────────────────────────────────────────────────────────────────────────────
//
// This is what powers the "My Resources" page in a real app.
// Users can see everything they've added and delete things they no longer need.

import db from './db';
import { deleteVectorsForResource } from './vector-store';

// ── List all resources for a user ─────────────────────────────────────────────
// Returns the resources sorted newest first
export async function listUserResources(userId: string) {
  const resources = await db.resource.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' }, // newest first
  });

  return resources;
}

// ── Get a single resource ────────────────────────────────────────────────────
export async function getResource(resourceId: string, userId: string) {
  const resource = await db.resource.findFirst({
    where: {
      id: resourceId,
      userId: userId, // ← security check: user can only access their own resources
    },
  });

  if (!resource) {
    throw new Error(`Resource not found or you don't have access to it`);
  }

  return resource;
}

// ── Delete a resource ─────────────────────────────────────────────────────────
//
// Deleting a resource has two parts:
//   1. Delete the vectors from Pinecone (the actual content)
//   2. Delete the metadata row from Postgres
//
// We need to do BOTH — if we only delete from Postgres, orphaned vectors
// remain in Pinecone and waste quota. If we only delete from Pinecone,
// the user still sees the resource in their list.
//
// CHALLENGE: We need the vector IDs to delete from Pinecone.
// In this implementation we use Pinecone's metadata filter.
// (On paid Pinecone plans you can delete by metadata directly.)
export async function deleteResource(
  resourceId: string,
  userId: string
): Promise<void> {
  // First verify the resource exists and belongs to this user
  const resource = await getResource(resourceId, userId);

  console.log(`\n🗑️  Deleting resource: "${resource.title}" (${resource.id})`);

  // NOTE: To delete vectors by resourceId from Pinecone, you have two options:
  //
  // Option A (Pinecone paid plan): Delete by metadata filter
  //   await index.namespace(userId).deleteMany({ filter: { resourceId: resourceId } })
  //
  // Option B (any plan): Store vector IDs in Postgres and delete by ID
  //   This requires adding a "vectorIds" field to the Resource model.
  //   For this demo we show Option A syntax (works on paid plans).
  //
  // For free plan: The vectors will be orphaned but won't affect answers
  // because Postgres won't return the resource and we never query orphans.
  // Clean them up by deleting and recreating the namespace periodically.

  try {
    const { pineconeClient, PINECONE_INDEX_NAME } = await import('./config');
    const index = pineconeClient.index(PINECONE_INDEX_NAME);

    // This works on Pinecone paid plans with metadata filtering enabled
    await index.namespace(userId).deleteMany({
      filter: { resourceId: { $eq: resourceId } },
    });

    console.log(`  Deleted vectors from Pinecone`);
  } catch (error) {
    // On free plans this may fail — log but continue to delete Postgres record
    console.warn(
      `  Could not delete Pinecone vectors (may need paid plan): ${error}`
    );
  }

  // Always delete the Postgres record
  await db.resource.delete({
    where: { id: resourceId },
  });

  console.log(`  ✅ Resource deleted from database`);
}

// ── Get stats for a user's knowledge base ────────────────────────────────────
export async function getUserStats(userId: string) {
  const resources = await db.resource.findMany({
    where: { userId: userId },
  });

  const totalChunks = resources.reduce((sum, r) => sum + r.chunkCount, 0);

  const byType = {
    PDF: resources.filter((r) => r.type === 'PDF').length,
    LINK: resources.filter((r) => r.type === 'LINK').length,
    TEXT: resources.filter((r) => r.type === 'TEXT').length,
  };

  return {
    totalResources: resources.length,
    totalChunks,
    byType,
  };
}
