import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error, formatPriority } from '../format.js';

export function issueCommand() {
  const cmd = new Command('issue')
    .description('Create a new issue')
    .argument('<title>', 'Issue title')
    .option('-g, --gov <gov>', 'Government slug or ID (omit for unfiled)')
    .option('-p, --priority <priority>', 'Priority 0-4 or P0-P4', '2')
    .option('-t, --type <type>', 'Type: report, request, complaint, other', 'report')
    .option('-b, --body <body>', 'Detailed description')
    .option('-l, --location <address>', 'Location/address')
    .action((title, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        // Resolve government
        let govId = null;
        let govName = null;
        if (options.gov) {
          const gov = government.find(dataDir, options.gov);
          if (!gov) {
            error(`Government not found: ${options.gov}`);
            process.exit(1);
          }
          govId = gov.id;
          govName = gov.name;
        }

        const iss = issue.create(dataDir, {
          title,
          gov_id: govId,
          priority: options.priority,
          type: options.type,
          body: options.body,
          location: options.location ? { address: options.location } : null
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: iss }, null, 2));
        } else {
          success(`Created issue: ${iss.title}`, opts);
          console.log(`  ID:       ${iss.id}`);
          console.log(`  Gov:      ${govName ? `${govName} (${govId})` : '(unfiled)'}`);
          console.log(`  Priority: ${formatPriority(iss.priority)}`);
          console.log(`  Status:   ${iss.status}`);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
