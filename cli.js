import { parseArgs } from 'util';
import watcher from './watcher/index.js';
import { getModulePathExtension } from './builder.js';
import fs from "fs";

let {
  values: {
    clientEntrypoint,
    serverEntrypoint
  }
} = parseArgs({
  options: {
    clientEntrypoint: {
      type: 'string',
      short: 'c',
    },
    serverEntrypoint: {
      type: 'string',
      short: 's'
    },
  }
});


clientEntrypoint = clientEntrypoint + getModulePathExtension(clientEntrypoint);
if (!fs.existsSync(clientEntrypoint))
  throw `Cannot find Client Entrypoint at [${clientEntrypoint}]`;

serverEntrypoint = serverEntrypoint + getModulePathExtension(serverEntrypoint);
if (!fs.existsSync(serverEntrypoint))
  throw `Cannot find Client Entrypoint at [${serverEntrypoint}]`;

if (fs.existsSync("./dist"))
  fs.rmSync("./dist", { recursive: true });

watcher(clientEntrypoint, serverEntrypoint);
