import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initCommand } from './commands/init.js';
import { govCommand } from './commands/gov.js';
import { issueCommand } from './commands/issue.js';
import { listCommand } from './commands/list.js';
import { showCommand } from './commands/show.js';
import { updateCommand } from './commands/update.js';
import { closeCommand } from './commands/close.js';
import { reopenCommand } from './commands/reopen.js';
import { assignCommand } from './commands/assign.js';
import { statsCommand } from './commands/stats.js';
import { serveCommand } from './commands/serve.js';
// New 4-column model commands
import { goalCommand } from './commands/goal.js';
import { problemCommand } from './commands/problem.js';
import { ideaCommand, supportCommand } from './commands/idea.js';
import { actionCommand } from './commands/action.js';
import { linkCommand, unlinkCommand, relationsCommand } from './commands/link.js';
import { classifyCommand, similarCommand, duplicatesCommand, insightsCommand } from './commands/classify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// Find .govtrack directory
export function findDataDir() {
  let dir = process.cwd();
  while (dir !== '/') {
    const govtrackDir = join(dir, '.govtrack');
    if (existsSync(govtrackDir)) {
      return govtrackDir;
    }
    dir = dirname(dir);
  }
  return null;
}

// Require initialized govtrack
export function requireDataDir() {
  const dataDir = findDataDir();
  if (!dataDir) {
    console.error('Error: Not a govtrack directory (or any parent). Run "govtrack init" first.');
    process.exit(1);
  }
  return dataDir;
}

export function run(argv) {
  const program = new Command();

  program
    .name('govtrack')
    .description('CLI-first issue tracker for local governments')
    .version(pkg.version)
    .option('--json', 'Output in JSON format')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--verbose', 'Show detailed output');

  // Store global options for commands to access
  program.hook('preAction', (thisCommand) => {
    const opts = program.opts();
    thisCommand._globalOpts = opts;
  });

  // Initialize
  program.addCommand(initCommand());

  // Government commands
  program.addCommand(govCommand());

  // Issue commands (shorthand for issue create)
  program.addCommand(issueCommand());

  // List issues
  program.addCommand(listCommand());

  // Show issue details
  program.addCommand(showCommand());

  // Update issue
  program.addCommand(updateCommand());

  // Close issue
  program.addCommand(closeCommand());

  // Reopen issue
  program.addCommand(reopenCommand());

  // Assign issue
  program.addCommand(assignCommand());

  // Stats
  program.addCommand(statsCommand());

  // Web server
  program.addCommand(serveCommand());

  // ========== 4-Column Model Commands ==========

  // Entity creation commands
  program.addCommand(goalCommand());
  program.addCommand(problemCommand());
  program.addCommand(ideaCommand());
  program.addCommand(actionCommand());

  // Relationship commands
  program.addCommand(linkCommand());
  program.addCommand(unlinkCommand());
  program.addCommand(relationsCommand());

  // Support command
  program.addCommand(supportCommand());

  // AI commands
  program.addCommand(classifyCommand());
  program.addCommand(similarCommand());
  program.addCommand(duplicatesCommand());
  program.addCommand(insightsCommand());

  program.parse(argv);
}
