const path = require('path');
const { createLogger, format, transports } = require('winston');
const { colorize, prettyPrint, errors, combine, splat, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

let entryPointFileName = process.argv.length > 1 && process.argv[1];
let infoLogPath;
let debugLogPath;
let filename = process.env.LOG_NAME || (entryPointFileName ? path.basename(entryPointFileName).replace(/\.[^/.]+$/, "") : 'console');
infoLogPath = path.join('logs', filename + '.info.log');
debugLogPath = path.join('logs', filename + '.debug.log');
console.log('log path:', infoLogPath, debugLogPath);

const logger = createLogger({
  format: combine(
    errors({stack: true}),
    colorize(),
    prettyPrint(),
    splat(),
    timestamp(),
    myFormat
  ),
  transports: [
		new transports.Console({level: 'info'}),
		new transports.File({filename: debugLogPath, level: 'debug'}),
		new transports.File({filename: infoLogPath, level: 'info'}),
  ]
});

module.exports = logger;
