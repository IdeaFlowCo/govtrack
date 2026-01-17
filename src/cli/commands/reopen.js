import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import { requireDataDir } from '../index.js';
import { success, error } from '../format.js';

export function reopenCommand() {
  const cmd = new Command('reopen')
    .description('Reopen a closed issue')
    .argument('<id>', 'Issue ID')
    .action((id, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const iss = issue.reopen(dataDir, id);

        if (!iss) {
          error(`Issue not found: ${id}`);
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: iss }, null, 2));
        } else {
          success(`Reopened issue: ${iss.id}`, opts);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
