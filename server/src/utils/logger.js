/** Tiny structured (JSON-lines) logger. Level via LOG_LEVEL: debug | info | warn | error | silent */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = () => LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...meta });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

module.exports = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};
