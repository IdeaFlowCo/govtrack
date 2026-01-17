import { Command } from 'commander';
import { requireDataDir } from '../index.js';
import { success, error, info } from '../format.js';

export function serveCommand() {
  const cmd = new Command('serve')
    .description('Start the web interface')
    .option('-p, --port <port>', 'Port number', '3000')
    .option('-H, --host <host>', 'Host to bind', 'localhost')
    .option('-o, --open', 'Open browser automatically')
    .action(async (options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        // Dynamic import to avoid loading express unless needed
        const { createServer } = await import('../../web/server.js');

        const port = parseInt(options.port, 10);
        const host = options.host;

        const server = createServer(dataDir);

        server.listen(port, host, () => {
          const url = `http://${host}:${port}`;
          success(`GovTrack web interface running`, opts);
          info(`  Local: ${url}`, opts);
          info('\nPress Ctrl+C to stop', opts);

          if (options.open) {
            // Open browser
            const { exec } = require('child_process');
            const cmd = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${cmd} ${url}`);
          }
        });
      } catch (err) {
        error(`Failed to start server: ${err.message}`);
        process.exit(1);
      }
    });

  return cmd;
}
