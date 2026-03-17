import { Blob, Pellet } from '@blobverse/shared';
import { EntityManager } from '../game/EntityManager.js';

/**
 * AI 輔助函數
 * 用於在 ArenaMatch 等獨立場景中快速構建 AIController 的輸入
 */

/**
 * 為所有 blob 構建 nearby blobs 地圖
 */
export function buildNearbyBlobsMap(
  blobs: Blob[],
  entityManager: EntityManager
): Map<string, Blob[]> {
  const map = new Map<string, Blob[]>();

  for (const blob of blobs) {
    if (!blob.isAlive) continue;
    const nearby = entityManager.getNearbyBlobs(blob as any);
    map.set(blob.id, nearby);
  }

  return map;
}

/**
 * 為所有 blob 構建 nearby pellets 地圖
 */
export function buildNearbyPelletsMap(
  blobs: Blob[],
  entityManager: EntityManager
): Map<string, Pellet[]> {
  const map = new Map<string, Pellet[]>();

  for (const blob of blobs) {
    if (!blob.isAlive) continue;
    // EntityManager.getNearbyPellets 需要 x, y, radius
    const nearby = entityManager.getNearbyPellets(blob.x, blob.y, blob.radius + 20) as Pellet[];
    map.set(blob.id, nearby);
  }

  return map;
}

/**
 * 一次性構建所有 AI 輸入地圖
 */
export function buildAIContextMaps(
  blobs: Blob[],
  entityManager: EntityManager
): {
  nearbyBlobsMap: Map<string, Blob[]>;
  nearbyPelletsMap: Map<string, Pellet[]>;
} {
  return {
    nearbyBlobsMap: buildNearbyBlobsMap(blobs, entityManager),
    nearbyPelletsMap: buildNearbyPelletsMap(blobs, entityManager),
  };
}

/**
 * 隨機選擇 AI 人格（用於初始化 Arena 中的 AI agents）
 */
export function randomAIPersonality(): 'aggressor' | 'survivor' | 'opportunist' | 'trickster' | 'herder' {
  const personalities = ['aggressor', 'survivor', 'opportunist'] as const;
  return personalities[Math.floor(Math.random() * personalities.length)];
}

/**
 * 生成 AI Agent 的初始化數據
 */
export interface AIAgentInit {
  name: string;
  personality: 'aggressor' | 'survivor' | 'opportunist' | 'trickster' | 'herder';
  difficulty: number;
  walletAddress?: string;
}

const AI_NAMES = [
  'Chompy', 'Blobby', 'Gloopy', 'Muncher', 'Slurp', 'Wobble', 'Nom', 'Gulp',
  'Squishy', 'Bouncy', 'Zippy', 'Bubbles', 'Floaty', 'Jiggly', 'Boing', 'Splat',
];

export function generateAIAgent(): AIAgentInit {
  return {
    name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)],
    personality: randomAIPersonality(),
    difficulty: 0.3 + Math.random() * 0.7, // 0.3 ~ 1.0
  };
}
