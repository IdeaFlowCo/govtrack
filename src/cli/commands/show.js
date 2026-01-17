import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { error, header, details, formatPriority, formatStatus, formatDate } from '../format.js';

export function showCommand() {
  const cmd = new Command('show')
    .description('Show issue details')
    .argument('<id>', 'Issue ID')
    .action((id, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const iss = issue.find(dataDir, id);
      if (!iss) {
        error(`Issue not found: ${id}`);
        process.exit(1);
      }

      // Get government info
      let govInfo = '(unfiled)';
      if (iss.gov_id) {
        const gov = government.find(dataDir, iss.gov_id);
        govInfo = gov ? `${gov.name} (${gov.id})` : iss.gov_id;
      }

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          data: { ...iss, government: govInfo }
        }, null, 2));
        return;
      }

      header(`Issue: ${iss.title}`);
      console.log(details({
        'ID': iss.id,
        'Status': formatStatus(iss.status),
        'Priority': formatPriority(iss.priority),
        'Type': iss.type,
        'Government': govInfo,
        'Location': iss.location?.address || '-',
        'Created': formatDate(iss.created_at),
        'Updated': formatDate(iss.updated_at)
      }));

      if (iss.body) {
        console.log('\nDescription:');
        console.log(iss.body);
      }

      if (iss.history && iss.history.length > 0) {
        console.log('\nHistory:');
        for (const entry of iss.history) {
          const date = formatDate(entry.timestamp);
          let desc = entry.action;
          if (entry.field) {
            desc = `${entry.field}: ${entry.old_value} → ${entry.new_value}`;
          }
          console.log(`  ${date}  ${desc}`);
        }
      }
    });

  return cmd;
}
