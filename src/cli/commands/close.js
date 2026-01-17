import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import { requireDataDir } from '../index.js';
import { success, error } from '../format.js';

export function closeCommand() {
  const cmd = new Command('close')
    .description('Close an issue')
    .argument('<id>', 'Issue ID')
    .option('-r, --reason <reason>', 'Reason for closing')
    .option('--wont-fix', 'Mark as won\'t fix instead of resolved')
    .action((id, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const iss = issue.close(dataDir, id, {
          reason: options.reason,
          wontFix: options.wontFix
        });

        if (!iss) {
          error(`Issue not found: ${id}`);
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: iss }, null, 2));
        } else {
          success(`Closed issue: ${iss.id} (${iss.status})`, opts);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
