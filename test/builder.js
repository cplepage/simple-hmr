import assert from "assert";
import fs from "fs";
import Build, { builder } from "../watcher/builder.js";
import { dirname } from "path";
import { execSync } from "child_process";

const testFiles = [
  {
    path: "test.js",
    contents: `import foo from "module";
    const bar = foo();
    export default bar;
    `
  },
  {
    path: "./.test/entrypoint.js",
    contents: `import {add} from "./module.js";
    console.log(add(1, 2));`
  },
  {
    path: "./.test/module.js",
    contents: `export const add = (a, b) => { return a + b };`
  },
  {
    path: "./.test/directory/nested/foo.js",
    contents: `import "../../bar.js"`
  },
  {
    path: "./.test/bar.js",
    contents: `import hi, {name } from "./baz.js";
    console.log(hi(name));`
  },
  {
    path: "./.test/baz.js",
    contents: `export const name = "world";
    export default function(name){ return "Hello " + name }`
  },

  {
    path: "./.test/directory/nested/foo2.js",
    contents: `import "../../bar2"`
  },
  {
    path: "./.test/bar2.js",
    contents: `import hi, {name } from "./baz2";
    console.log(hi(name));`
  },
  {
    path: "./.test/baz2.js",
    contents: `export const name = "world";
    export default function(name){ return "Hello " + name }`
  },

  {
    path: "./node_modules/test-module/index.mjs",
    contents: `export default function () { console.log("Hello from Module"); }`
  },
  {
    path: "./node_modules/test-module/package.json",
    contents: JSON.stringify({
      name: "test-module",
      exports: {
        ".": "./index.mjs"
      }
    }, null, 2)
  },
  {
    path: "./.test/externalModule.js",
    contents: `import TestModule from "test-module";
    import "./externalModule2.js";
    TestModule();`
  },
  {
    path: "./.test/externalModule2.js",
    contents: `import TestModule from "test-module";
    TestModule();`
  }
]

const dirToRemove = [
  { path: "dist" },
  { path: ".test" }
]

describe('Builder Watch', function() {

  before(function() {
    testFiles.forEach(file => {
      const dir = dirname(file.path);
      if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file.path, file.contents);
    })
  })

  it('Should not convert externalModules', async function() {
    await builder({
      entrypoint: testFiles.at(0).path
    });
    assert.ok(fs.existsSync("./dist/test.js"));

    const builtFileLines = fs.readFileSync("./dist/test.js").toString().split(";").map(line => line.trim());
    assert.deepEqual(builtFileLines.at(0), `import foo from "module"`);
  });

  it('Should convert externalModules', async function() {
    const { externalModules } = await builder({
      entrypoint: testFiles.at(0).path,
      recurse: false,
      convertExternalModules: true,
      bundleName: "/externals.js"
    });
    assert.ok(fs.existsSync("./dist/test.js"));
    assert.deepEqual(externalModules, ["module"]);

    const builtFileLines = fs.readFileSync("./dist/test.js").toString().split(";").map(line => line.trim());
    assert.deepEqual(builtFileLines.splice(0, 2), [
      `const { externalModule0 } = await import("/externals.js")`,
      `const foo = externalModule0.default`
    ]);
  });

  it('Should build recursively and eval the same result (easy)', async function() {
    const expected = execSync(`node ${testFiles.at(1).path}`).toString();

    const { modulesFlatTree } = await builder({
      entrypoint: testFiles.at(1).path,
      recurse: true
    });

    assert.deepEqual(modulesFlatTree, {
      './.test/entrypoint.js': { jsx: false },
      './.test/module.js': { jsx: false, parents: ['./.test/entrypoint.js'] }
    })
    assert.equal(execSync(`node ./dist/.test/entrypoint.js`).toString(), expected);
  });

  it('Should build recursively and eval the same result (hard)', async function() {
    const expected = execSync(`node ${testFiles.at(3).path}`).toString();

    const { modulesFlatTree } = await builder({
      entrypoint: testFiles.at(3).path,
      recurse: true
    });

    assert.deepEqual(modulesFlatTree, {
      './.test/directory/nested/foo.js': { jsx: false },
      './.test/bar.js': { jsx: false, parents: ['./.test/directory/nested/foo.js'] },
      './.test/baz.js': { jsx: false, parents: ['./.test/bar.js'] },
    });

    assert.equal(execSync(`node ./dist/.test/directory/nested/foo.js`).toString(), expected);
  });

  it('Should build recursively and eval the same result (hard) without extensions', async function() {
    const expected = execSync(`node ${testFiles.at(3).path}`).toString();

    const { modulesFlatTree } = await builder({
      entrypoint: testFiles.at(6).path.slice(0, -3),
      recurse: true
    });

    assert.deepEqual(modulesFlatTree, {
      './.test/directory/nested/foo2.js': { jsx: false },
      './.test/bar2.js': { jsx: false, parents: ['./.test/directory/nested/foo2.js'] },
      './.test/baz2.js': { jsx: false, parents: ['./.test/bar2.js'] },
    });

    assert.equal(execSync(`node ./dist/.test/directory/nested/foo2.js`).toString(), expected);
  });

  it('Should bundle external modules', async function() {
    const expected = execSync(`node ${testFiles.at(11).path}`).toString().trim();
    assert.equal(expected, "Hello from Module\nHello from Module");

    const moduleFlatTree = await Build({
      entrypoint: testFiles.at(11).path,
      outdir: "dist",
      recurse: true,
      externalModules: {
        convert: true,
        bundle: true,
        bundleClientName: "./externals.js",
        bundleOutdir: "dist/.test"
      }
    });

    assert.deepEqual(moduleFlatTree, {
      "./.test/externalModule.js": { jsx: false },
      "./.test/externalModule2.js": { jsx: false, parents: ["./.test/externalModule.js"] }
    })

    assert.ok(fs.existsSync("./dist/.test/externals.js"));
    assert.equal(execSync(`node ./dist/.test/externalModule.js`).toString().trim(), expected)
  });

  after(function() {
    testFiles.concat(dirToRemove).forEach(file => {
      fs.rmSync(file.path, { recursive: true, force: true });
    })
  })
})
