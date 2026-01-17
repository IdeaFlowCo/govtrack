import { join } from 'path';
import * as storage from './storage.js';
import { generateId, generateSlug, makeSlugUnique, isValidId } from './id.js';

const GOVERNMENT_TYPES = ['city', 'county', 'state', 'federal', 'district', 'other'];
const GOVERNMENT_STATUSES = ['active', 'inactive'];

/**
 * Get the governments file path
 * @param {string} dataDir - Data directory path
 * @returns {string} Path to governments.jsonl
 */
export function getFilePath(dataDir) {
  return join(dataDir, 'governments.jsonl');
}

/**
 * Create a new government
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Government data
 * @returns {Object} Created government
 */
export function create(dataDir, data) {
  const filePath = getFilePath(dataDir);

  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Government name is required');
  }

  if (data.name.length > 200) {
    throw new Error('Government name must be 200 characters or less');
  }

  // Validate type
  const type = data.type || 'city';
  if (!GOVERNMENT_TYPES.includes(type)) {
    throw new Error(`Invalid government type. Must be one of: ${GOVERNMENT_TYPES.join(', ')}`);
  }

  // Validate state
  if (data.state && !/^[A-Z]{2}$/.test(data.state)) {
    throw new Error('State must be a 2-letter uppercase code (e.g., TX, CA)');
  }

  // Generate slug
  let slug = data.slug || generateSlug(data.name);
  slug = makeSlugUnique(slug, (s) => !storage.isUnique(filePath, 'slug', s));

  // Generate ID
  const id = generateId('gt', { name: data.name, type, slug },
    (id) => storage.findById(filePath, id) !== null);

  const now = new Date().toISOString();

  const government = {
    id,
    slug,
    name: data.name.trim(),
    type,
    state: data.state || null,
    status: 'active',
    created_at: now,
    updated_at: now,
    metadata: data.metadata || {}
  };

  storage.appendRecord(filePath, government);
  return government;
}

/**
 * Get all governments
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of governments
 */
export function list(dataDir, filters = {}) {
  const filePath = getFilePath(dataDir);
  let governments = storage.readAll(filePath);

  if (filters.type) {
    governments = governments.filter(g => g.type === filters.type);
  }

  if (filters.state) {
    governments = governments.filter(g => g.state === filters.state);
  }

  if (filters.status) {
    governments = governments.filter(g => g.status === filters.status);
  }

  return governments;
}

/**
 * Find a government by ID or slug
 * @param {string} dataDir - Data directory path
 * @param {string} idOrSlug - Government ID or slug
 * @returns {Object|null} Government or null
 */
export function find(dataDir, idOrSlug) {
  const filePath = getFilePath(dataDir);

  // Try ID first
  if (isValidId(idOrSlug, 'gt')) {
    return storage.findById(filePath, idOrSlug);
  }

  // Try slug
  return storage.findBy(filePath, 'slug', idOrSlug);
}

/**
 * Update a government
 * @param {string} dataDir - Data directory path
 * @param {string} idOrSlug - Government ID or slug
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated government or null
 */
export function update(dataDir, idOrSlug, updates) {
  const filePath = getFilePath(dataDir);
  const gov = find(dataDir, idOrSlug);

  if (!gov) {
    return null;
  }

  const allowedUpdates = {};

  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || updates.name.length > 200) {
      throw new Error('Invalid name');
    }
    allowedUpdates.name = updates.name.trim();
  }

  if (updates.status !== undefined) {
    if (!GOVERNMENT_STATUSES.includes(updates.status)) {
      throw new Error(`Invalid status. Must be one of: ${GOVERNMENT_STATUSES.join(', ')}`);
    }
    allowedUpdates.status = updates.status;
  }

  if (updates.metadata !== undefined) {
    allowedUpdates.metadata = { ...gov.metadata, ...updates.metadata };
  }

  return storage.updateRecord(filePath, gov.id, allowedUpdates);
}

/**
 * Delete a government
 * @param {string} dataDir - Data directory path
 * @param {string} idOrSlug - Government ID or slug
 * @returns {boolean} True if deleted
 */
export function remove(dataDir, idOrSlug) {
  const filePath = getFilePath(dataDir);
  const gov = find(dataDir, idOrSlug);

  if (!gov) {
    return false;
  }

  return storage.deleteRecord(filePath, gov.id);
}

/**
 * Get valid government types
 * @returns {Array} Array of valid types
 */
export function getTypes() {
  return [...GOVERNMENT_TYPES];
}

/**
 * Get valid government statuses
 * @returns {Array} Array of valid statuses
 */
export function getStatuses() {
  return [...GOVERNMENT_STATUSES];
}
