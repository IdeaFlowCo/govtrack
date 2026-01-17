import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import { requireDataDir } from '../index.js';
import { success, error } from '../format.js';

export function updateCommand() {
  const cmd = new Command('update')
    .description('Update an issue')
    .argument('<id>', 'Issue ID')
    .option('-s, --status <status>', 'New status')
    .option('-p, --priority <priority>', 'New priority')
    .option('--title <title>', 'New title')
    .option('--body <body>', 'New description')
    .action((id, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const updates = {};
      if (options.status) updates.status = options.status;
      if (options.priority !== undefined) updates.priority = options.priority;
      if (options.title) updates.title = options.title;
      if (options.body !== undefined) updates.body = options.body;

      if (Object.keys(updates).length === 0) {
        error('No updates specified. Use --status, --priority, --title, or --body.');
        process.exit(1);
      }

      try {
        const iss = issue.update(dataDir, id, updates);
        if (!iss) {
          error(`Issue not found: ${id}`);
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: iss }, null, 2));
        } else {
          success(`Updated issue: ${iss.id}`, opts);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
