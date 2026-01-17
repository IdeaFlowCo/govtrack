import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { info, table, formatPriority, formatStatus } from '../format.js';

export function listCommand() {
  const cmd = new Command('list')
    .description('List issues')
    .option('-g, --gov <gov>', 'Filter by government slug or ID')
    .option('--unfiled', 'Show only unfiled issues')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option('-t, --type <type>', 'Filter by type')
    .option('-n, --limit <n>', 'Limit results', '50')
    .option('--all', 'Show all results (no limit)')
    .action((options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const filters = {};
      if (options.gov) filters.gov_id = options.gov;
      if (options.unfiled) filters.unfiled = true;
      if (options.status) filters.status = options.status;
      if (options.type) filters.type = options.type;
      if (options.priority !== undefined) {
        let p = options.priority;
        if (typeof p === 'string') {
          const match = p.match(/^P?(\d)$/i);
          if (match) p = parseInt(match[1], 10);
        }
        filters.priority = parseInt(p, 10);
      }
      if (!options.all) {
        filters.limit = parseInt(options.limit, 10);
      }

      const issues = issue.list(dataDir, filters);

      // Get government names for display
      const govCache = {};
      const issuesWithGov = issues.map(iss => {
        let govDisplay = '(unfiled)';
        if (iss.gov_id) {
          if (!govCache[iss.gov_id]) {
            const gov = government.find(dataDir, iss.gov_id);
            govCache[iss.gov_id] = gov?.slug || iss.gov_id;
          }
          govDisplay = govCache[iss.gov_id];
        }
        return {
          ...iss,
          gov_display: govDisplay,
          priority_display: `P${iss.priority}`
        };
      });

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          data: { issues: issuesWithGov, total: issuesWithGov.length }
        }, null, 2));
        return;
      }

      if (issuesWithGov.length === 0) {
        info('No issues found.', opts);
        return;
      }

      const output = table(issuesWithGov, [
        { key: 'id', label: 'ID', width: 8 },
        { key: 'priority_display', label: 'PRIORITY', width: 9 },
        { key: 'status', label: 'STATUS', width: 12 },
        { key: 'gov_display', label: 'GOVERNMENT', width: 18 },
        { key: 'title', label: 'TITLE', width: 40 }
      ]);
      console.log(output);
    });

  return cmd;
}
