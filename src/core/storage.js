import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Read all records from a JSONL file
 * @param {string} filePath - Path to JSONL file
 * @returns {Array} Array of parsed records
 */
export function readAll(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return [];
  }

  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * Append a record to a JSONL file
 * @param {string} filePath - Path to JSONL file
 * @param {Object} record - Record to append
 */
export function appendRecord(filePath, record) {
  ensureDir(filePath);
  const line = JSON.stringify(record) + '\n';
  appendFileSync(filePath, line, 'utf8');
}

/**
 * Update a record in a JSONL file by ID
 * @param {string} filePath - Path to JSONL file
 * @param {string} id - Record ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated record or null if not found
 */
export function updateRecord(filePath, id, updates) {
  if (!existsSync(filePath)) {
    return null;
  }

  const records = readAll(filePath);
  let found = null;

  const updated = records.map(record => {
    if (record.id === id) {
      found = {
        ...record,
        ...updates,
        updated_at: new Date().toISOString()
      };
      return found;
    }
    return record;
  });

  if (found) {
    writeAll(filePath, updated);
  }

  return found;
}

/**
 * Delete a record from a JSONL file by ID
 * @param {string} filePath - Path to JSONL file
 * @param {string} id - Record ID to delete
 * @returns {boolean} True if record was deleted
 */
export function deleteRecord(filePath, id) {
  if (!existsSync(filePath)) {
    return false;
  }

  const records = readAll(filePath);
  const filtered = records.filter(record => record.id !== id);

  if (filtered.length === records.length) {
    return false;
  }

  writeAll(filePath, filtered);
  return true;
}

/**
 * Find a record by ID
 * @param {string} filePath - Path to JSONL file
 * @param {string} id - Record ID
 * @returns {Object|null} Found record or null
 */
export function findById(filePath, id) {
  const records = readAll(filePath);
  return records.find(r => r.id === id) || null;
}

/**
 * Find a record by a field value
 * @param {string} filePath - Path to JSONL file
 * @param {string} field - Field name
 * @param {*} value - Field value to match
 * @returns {Object|null} Found record or null
 */
export function findBy(filePath, field, value) {
  const records = readAll(filePath);
  return records.find(r => r[field] === value) || null;
}

/**
 * Filter records by criteria
 * @param {string} filePath - Path to JSONL file
 * @param {Object} criteria - Key-value pairs to match
 * @returns {Array} Matching records
 */
export function filter(filePath, criteria) {
  const records = readAll(filePath);
  return records.filter(record => {
    return Object.entries(criteria).every(([key, value]) => {
      if (value === null) {
        return record[key] === null || record[key] === undefined;
      }
      return record[key] === value;
    });
  });
}

/**
 * Write all records to a JSONL file (overwrites existing)
 * @param {string} filePath - Path to JSONL file
 * @param {Array} records - Records to write
 */
export function writeAll(filePath, records) {
  ensureDir(filePath);
  const content = records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Ensure parent directory exists
 * @param {string} filePath - File path
 */
function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if a value is unique in a file
 * @param {string} filePath - Path to JSONL file
 * @param {string} field - Field name
 * @param {*} value - Value to check
 * @param {string} [excludeId] - ID to exclude from check
 * @returns {boolean} True if unique
 */
export function isUnique(filePath, field, value, excludeId = null) {
  const records = readAll(filePath);
  return !records.some(r => r[field] === value && r.id !== excludeId);
}
