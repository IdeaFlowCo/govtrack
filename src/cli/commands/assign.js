import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error } from '../format.js';

export function assignCommand() {
  const cmd = new Command('assign')
    .description('Assign an issue to a government')
    .argument('<issue-id>', 'Issue ID')
    .argument('[gov-id]', 'Government slug or ID')
    .option('--unfile', 'Remove government assignment')
    .action((issueId, govId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      if (!govId && !options.unfile) {
        error('Specify a government ID or use --unfile to remove assignment.');
        process.exit(1);
      }

      try {
        let targetGov = null;
        if (govId && !options.unfile) {
          targetGov = government.find(dataDir, govId);
          if (!targetGov) {
            error(`Government not found: ${govId}`);
            process.exit(1);
          }
        }

        const iss = issue.assign(dataDir, issueId, options.unfile ? null : targetGov?.id);

        if (!iss) {
          error(`Issue not found: ${issueId}`);
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: iss }, null, 2));
        } else {
          if (options.unfile || !targetGov) {
            success(`Unfiled issue: ${iss.id}`, opts);
          } else {
            success(`Assigned issue ${iss.id} to ${targetGov.name}`, opts);
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
