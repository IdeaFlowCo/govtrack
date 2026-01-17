import { createHash, randomBytes } from 'crypto';

/**
 * Entity type prefixes for the 4-column model
 */
export const ENTITY_PREFIXES = {
  goal: 'gg',
  problem: 'gp',
  idea: 'gd',
  action: 'ga',
  government: 'gt',
  issue: 'gi'  // Legacy support
};

/**
 * Reverse mapping: prefix -> entity type
 */
const PREFIX_TO_TYPE = Object.fromEntries(
  Object.entries(ENTITY_PREFIXES).map(([type, prefix]) => [prefix, type])
);

/**
 * Get entity type from ID prefix
 * @param {string} id - Entity ID (e.g., 'gg-a1b2')
 * @returns {string|null} Entity type or null if invalid
 */
export function getTypeFromId(id) {
  if (!id || typeof id !== 'string') return null;
  const match = id.match(/^([a-z]{2})-/);
  if (!match) return null;
  return PREFIX_TO_TYPE[match[1]] || null;
}

/**
 * Get the prefix for a given entity type
 * @param {string} type - Entity type (e.g., 'goal', 'problem')
 * @returns {string} Prefix for the type
 */
export function getPrefixForType(type) {
  return ENTITY_PREFIXES[type] || 'ge'; // 'ge' for generic entity
}

/**
 * Check if an ID belongs to a specific entity type
 * @param {string} id - Entity ID
 * @param {string} type - Expected entity type
 * @returns {boolean} True if ID matches type
 */
export function isEntityType(id, type) {
  return getTypeFromId(id) === type;
}

/**
 * Generate a unique ID with the given prefix
 * @param {string} prefix - ID prefix (e.g., 'gt' for government, 'gi' for issue)
 * @param {Object} inputs - Data to include in hash
 * @param {Function} [existsCheck] - Optional function to check if ID exists
 * @returns {string} Generated ID (e.g., 'gt-a1b2')
 */
export function generateId(prefix, inputs, existsCheck = null) {
  const maxAttempts = 5;
  let hashLength = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = JSON.stringify({
      ...inputs,
      timestamp: Date.now(),
      salt: randomBytes(4).toString('hex'),
      attempt
    });

    const hash = createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, hashLength);

    const id = `${prefix}-${hash}`;

    // If no existence check provided, or ID doesn't exist, return it
    if (!existsCheck || !existsCheck(id)) {
      return id;
    }

    // On third attempt, increase hash length
    if (attempt === 2) {
      hashLength = 5;
    }
  }

  // Fallback: use longer hash with timestamp
  const fallbackHash = createHash('sha256')
    .update(JSON.stringify({ ...inputs, timestamp: Date.now(), random: randomBytes(8).toString('hex') }))
    .digest('hex')
    .substring(0, 8);

  return `${prefix}-${fallbackHash}`;
}

/**
 * Generate a URL-friendly slug from a name
 * @param {string} name - Name to convert
 * @returns {string} URL-friendly slug
 */
export function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Make a slug unique by appending a counter if needed
 * @param {string} baseSlug - Base slug
 * @param {Function} existsCheck - Function to check if slug exists
 * @returns {string} Unique slug
 */
export function makeSlugUnique(baseSlug, existsCheck) {
  if (!existsCheck(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (counter < 1000) {
    const slug = `${baseSlug}-${counter}`;
    if (!existsCheck(slug)) {
      return slug;
    }
    counter++;
  }

  // Fallback: append random suffix
  return `${baseSlug}-${randomBytes(3).toString('hex')}`;
}

/**
 * Validate an ID format
 * @param {string} id - ID to validate
 * @param {string} prefix - Expected prefix
 * @returns {boolean} True if valid
 */
export function isValidId(id, prefix) {
  const pattern = new RegExp(`^${prefix}-[a-f0-9]{4,8}$`);
  return pattern.test(id);
}
