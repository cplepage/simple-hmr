import assert from "assert";
import fs from "fs";
import Build, { builder } from "../watcher/builder.js";
import { dirname } from "path";
import { execSync } from "child_process";

const testFiles = [
  { // 0
    path: "test.js",
    contents: `import foo from "module";
    const bar = foo();
    export default bar;
    `
  },
  { // 1
    path: "./.test/entrypoint.js",
    contents: `import {add} from "./module.js";
    console.log(add(1, 2));`
  },
  { // 2
    path: "./.test/module.js",
    contents: `export const add = (a, b) => { return a + b };`
  },
  { // 3
    path: "./.test/directory/nested/foo.js",
    contents: `import "../../bar.js"`
  },
  { // 4
    path: "./.test/bar.js",
    contents: `import hi, {name } from "./baz.js";
    console.log(hi(name));`
  },
  { // 5
    path: "./.test/baz.js",
    contents: `export const name = "world";
    export default function(name){ return "Hello " + name }`
  },

  { // 6
    path: "./.test/directory/nested/foo2.js",
    contents: `import "../../bar2"`
  },
  { // 7
    path: "./.test/bar2.js",
    contents: `import hi, {name } from "./baz2";
    console.log(hi(name));`
  },
  { // 8
    path: "./.test/baz2.js",
    contents: `export const name = "world";
    export default function(name){ return "Hello " + name }`
  },

  { // 9
    path: "./node_modules/test-module/index.mjs",
    contents: `export default function () { console.log("Hello from Module"); }`
  },
  { // 10
    path: "./node_modules/test-module/package.json",
    contents: JSON.stringify({
      name: "test-module",
      exports: {
        ".": "./index.mjs"
      }
    }, null, 2)
  },
  { // 11
    path: "./.test/externalModule.js",
    contents: `import TestModule from "test-module";
    import "./externalModule2.js";
    TestModule();`
  },
  { // 12
    path: "./.test/externalModule2.js",
    contents: `import TestModule from "test-module";
    TestModule();`
  },

  { // 13
    path: "./.test/style.css",
    contents: `html, body { font-family: sans-serif; }`
  },
  { // 14
    path: "./.test/asset.json",
    contents: `{ "key": "value" }`
  },
  { // 15
    path: "./.test/cssAndAssetImport.js",
    contents: `import "./style.css";
    import assetJSON from "./asset.json";`
  },

  { // 16
    path: "./node_modules/test-module/some-style.css",
    contents: `p { color: darkgray; }`
  },
  { // 17
    path: "./.test/css-bundling.js",
    contents: `import "./style.css";
    import "test-module/some-style.css";`
  },
]

const dirToRemove = [
  { path: "dist" },
  { path: ".test" },
  { path: "./node_modules/test-module" }
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
      './.test/entrypoint.js': {
        imports: new Set(["./.test/module.js"])
      },
      './.test/module.js': {
        imports: new Set(),
        parents: ['./.test/entrypoint.js']
      }
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
      './.test/directory/nested/foo.js': {
        imports: new Set(['./.test/bar.js'])
      },
      './.test/bar.js': {
        imports: new Set(['./.test/baz.js']),
        parents: ['./.test/directory/nested/foo.js']
      },
      './.test/baz.js': {
        imports: new Set(),
        parents: ['./.test/bar.js']
      },
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
      './.test/directory/nested/foo2.js': {
        imports: new Set(['./.test/bar2.js'])
      },
      './.test/bar2.js': {
        imports: new Set(['./.test/baz2.js']),
        parents: ['./.test/directory/nested/foo2.js']
      },
      './.test/baz2.js': {
        imports: new Set(),
        parents: ['./.test/bar2.js']
      },
    });

    assert.equal(execSync(`node ./dist/.test/directory/nested/foo2.js`).toString(), expected);
  });

  it('Should bundle external modules', async function() {
    const expected = execSync(`node ${testFiles.at(11).path}`).toString().trim();
    assert.equal(expected, "Hello from Module\nHello from Module");

    const { modulesFlatTree } = await Build({
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

    assert.deepEqual(modulesFlatTree, {
      "./.test/externalModule.js": {
        imports: new Set([
          './.test/externalModule2.js',
          'test-module'
        ])
      },
      "./.test/externalModule2.js": {
        imports: new Set([
          'test-module'
        ]),
        parents: ["./.test/externalModule.js"]
      }
    })

    assert.ok(fs.existsSync("./dist/.test/externals.js"));
    assert.equal(execSync(`node ./dist/.test/externalModule.js`).toString().trim(), expected)
  });

  it('Should bundle css and copy assets', async function() {
    const { modulesFlatTree } = await Build({
      entrypoint: testFiles.at(15).path,
      outdir: "dist",
      recurse: true,
      externalModules: {
        convert: false
      }
    });

    assert.ok(fs.existsSync("./dist/.test/index.css"));

    assert.ok(fs.existsSync(modulesFlatTree["./.test/asset.json"].out));
    assert.equal(fs.readFileSync(modulesFlatTree["./.test/asset.json"].out).toString(), testFiles.at(14).contents);
  });

  it('Should bundle css from node_modules', async function() {
    await Build({
      entrypoint: testFiles.at(17).path,
      outdir: "dist",
      recurse: true,
      externalModules: {
        convert: true
      }
    });

    assert.ok(fs.existsSync("./dist/.test/index.css"));
    assert.ok(fs.readFileSync("./dist/.test/index.css").toString().includes("color: darkgray"));
    assert.ok(fs.readFileSync("./dist/.test/index.css").toString().includes("font-family: sans-serif"));
  })

  after(function() {
    testFiles.concat(dirToRemove).forEach(file => {
      fs.rmSync(file.path, { recursive: true, force: true });
    })
  })
})
