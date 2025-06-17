// Modified server startup for clinic profiling
// This version exits cleanly when receiving SIGINT/SIGTERM

// Track if we're already shutting down
let isShuttingDown = false;

// Override default SIGINT handling BEFORE importing server
process.removeAllListeners('SIGINT');
process.on('SIGINT', () => {
  if (!isShuttingDown) {
    isShuttingDown = true;
    console.log('\nReceived SIGINT, exiting for clinic profiling...');
    // Immediate exit for clinic tools
    process.exit(0);
  }
});

// Now import the server
import './server';

// Override the error throwing behavior for clinic tools
process.on('uncaughtException', (error) => {
  if (error.message === 'Server shutdown complete') {
    // Exit cleanly for clinic tools
    process.exit(0);
  } else {
    // Log error but still exit cleanly for clinic
    console.error('Uncaught exception:', error);
    process.exit(0);
  }
});