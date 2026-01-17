import chalk from 'chalk';

/**
 * Format output based on global options
 * @param {*} data - Data to format
 * @param {Object} opts - Global options
 * @returns {string} Formatted output
 */
export function formatOutput(data, opts = {}) {
  if (opts.json) {
    return JSON.stringify(data, null, 2);
  }
  return data;
}

/**
 * Print a success message
 * @param {string} message - Message to print
 * @param {Object} opts - Global options
 */
export function success(message, opts = {}) {
  if (opts.quiet) return;
  console.log(chalk.green('✓') + ' ' + message);
}

/**
 * Print an error message
 * @param {string} message - Message to print
 */
export function error(message) {
  console.error(chalk.red('Error:') + ' ' + message);
}

/**
 * Print a warning message
 * @param {string} message - Message to print
 * @param {Object} opts - Global options
 */
export function warn(message, opts = {}) {
  if (opts.quiet) return;
  console.log(chalk.yellow('Warning:') + ' ' + message);
}

/**
 * Print an info message
 * @param {string} message - Message to print
 * @param {Object} opts - Global options
 */
export function info(message, opts = {}) {
  if (opts.quiet) return;
  console.log(message);
}

/**
 * Format a table of data
 * @param {Array} rows - Array of objects
 * @param {Array} columns - Column definitions [{key, label, width}]
 * @returns {string} Formatted table
 */
export function table(rows, columns) {
  if (rows.length === 0) {
    return '';
  }

  // Calculate column widths
  const widths = columns.map(col => {
    const headerWidth = col.label.length;
    const dataWidth = Math.max(...rows.map(row => String(row[col.key] ?? '').length));
    return col.width || Math.max(headerWidth, dataWidth);
  });

  // Build header
  const header = columns.map((col, i) => col.label.padEnd(widths[i])).join('  ');
  const separator = columns.map((_, i) => '-'.repeat(widths[i])).join('  ');

  // Build rows
  const dataRows = rows.map(row => {
    return columns.map((col, i) => {
      const value = String(row[col.key] ?? '');
      return value.padEnd(widths[i]).substring(0, widths[i]);
    }).join('  ');
  });

  return [header, separator, ...dataRows].join('\n');
}

/**
 * Format priority with color
 * @param {number} priority - Priority value (0-4)
 * @returns {string} Colored priority string
 */
export function formatPriority(priority) {
  const labels = {
    0: chalk.red.bold('P0'),
    1: chalk.red('P1'),
    2: chalk.yellow('P2'),
    3: chalk.blue('P3'),
    4: chalk.gray('P4')
  };
  return labels[priority] || `P${priority}`;
}

/**
 * Format status with color
 * @param {string} status - Status value
 * @returns {string} Colored status string
 */
export function formatStatus(status) {
  const colors = {
    open: chalk.green,
    in_progress: chalk.yellow,
    resolved: chalk.blue,
    closed: chalk.gray,
    wont_fix: chalk.gray
  };
  const fn = colors[status] || chalk.white;
  return fn(status);
}

/**
 * Format government type
 * @param {string} type - Government type
 * @returns {string} Formatted type
 */
export function formatGovType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format date for display
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(isoDate) {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a key-value detail section
 * @param {Object} data - Key-value pairs
 * @returns {string} Formatted section
 */
export function details(data) {
  const maxKeyLen = Math.max(...Object.keys(data).map(k => k.length));
  return Object.entries(data)
    .map(([key, value]) => `  ${chalk.gray(key.padEnd(maxKeyLen))}  ${value}`)
    .join('\n');
}

/**
 * Print a header/title
 * @param {string} title - Title text
 */
export function header(title) {
  console.log(chalk.bold(title));
  console.log(chalk.gray('─'.repeat(title.length + 4)));
}
