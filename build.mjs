import builder from "./builder.mjs";
import { promises as fs } from "fs";

try {
  await fs.rm("dist", { recursive: true });
} catch (e) { }

console.log(await builder("./client/index.jsx"))
