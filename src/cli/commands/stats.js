import { Command } from 'commander';
import * as issue from '../../core/issue.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { header, details } from '../format.js';

export function statsCommand() {
  const cmd = new Command('stats')
    .description('Show tracker statistics')
    .action((options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const govs = government.list(dataDir);
      const issues = issue.list(dataDir);

      // Count issues by status
      const byStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0, wont_fix: 0 };
      const byPriority = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      let unfiled = 0;

      for (const iss of issues) {
        byStatus[iss.status] = (byStatus[iss.status] || 0) + 1;
        byPriority[iss.priority] = (byPriority[iss.priority] || 0) + 1;
        if (!iss.gov_id) unfiled++;
      }

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          data: {
            governments: govs.length,
            issues: {
              total: issues.length,
              ...byStatus,
              unfiled
            },
            by_priority: byPriority
          }
        }, null, 2));
        return;
      }

      header('GovTrack Statistics');
      console.log(details({
        'Governments': govs.length,
        'Total Issues': issues.length
      }));

      console.log('\nBy Status:');
      console.log(details({
        'Open': byStatus.open,
        'In Progress': byStatus.in_progress,
        'Resolved': byStatus.resolved,
        'Closed': byStatus.closed,
        'Won\'t Fix': byStatus.wont_fix
      }));

      console.log('\nBy Priority:');
      console.log(details({
        'P0 (Critical)': byPriority[0],
        'P1 (High)': byPriority[1],
        'P2 (Medium)': byPriority[2],
        'P3 (Low)': byPriority[3],
        'P4 (Backlog)': byPriority[4]
      }));

      console.log('\n' + details({
        'Unfiled Issues': unfiled
      }));
    });

  return cmd;
}
