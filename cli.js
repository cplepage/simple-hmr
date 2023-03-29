import watcher from './watcher/index.js';
import { getModulePathExtension } from './watcher/builder.js';
import fs from "fs";

let clientEntrypoint, serverEntrypoint;

process.argv.forEach((arg, index) => {
  if (arg === '-c') clientEntrypoint = process.argv[index + 1];
  if (arg === '-s') serverEntrypoint = process.argv[index + 1];
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
