import assert from "assert";
import {
  analyzeRawImportStatement, convertImportDefinitionToAsyncImport,
  mergeImportsDefinitions, replaceLines, tokenizeImports
} from "../importsParser.js";

const testString = `// this is comment in my file

  import defaultExport from "module-name"
  import * as name from "module-name-1";
  import { export1 } from "module-name"
  import { export1 as alias1 } from 'module-name';
  import { default as alias } from "module-name-2";
  import { export1, export2 } from "module-name"
  import {
    export1,
    export2 as alias2
  } from "module-name";
  import
    defaultExport,
    { export1 } from "module-name"
  import defaultExport, * as name from "module-name";
  import "module"
  import myModule,{nameFunction} from "./myModule"
  import "./style.css";
  import assetURL from "./asset.png"
  import type {sometype} from "../module";

  export function foo(){
    return "bar";
  }

  const asyncModule = await import("./myOtherModule");

  const x = "baz";

  export default x;
`;

const testString2 = `
  import Module from "module";
  import {method1, method2} from "module";
`;

describe('Imports Parser', function() {

  it('Should isolate import statements', function() {
    assert.deepEqual(tokenizeImports(undefined), null);
    assert.deepEqual(tokenizeImports(""), null);
    assert.deepEqual(tokenizeImports(2), null);
    assert.deepEqual(tokenizeImports(`// just a comment`), {
      lines: [undefined, undefined],
      statements: []
    });
    assert.deepEqual(tokenizeImports(`const x = await import("./myModule"); function noImports(){ return "nothing" }`), {
      lines: [undefined, undefined],
      statements: []
    });

    assert.deepEqual(tokenizeImports(testString), {
      lines: [2, 20],
      statements: [
        ["import", "defaultExport", "from", "\"module-name\""], // 0
        ["import", "*", "as", "name", "from", "\"module-name-1\""],// 1
        ["import", "{", "export1", "}", "from", "\"module-name\""], // 2
        ["import", "{", "export1", "as", "alias1", "}", "from", "'module-name'"], // 3
        ["import", "{", "default", "as", "alias", "}", "from", "\"module-name-2\""], // 4
        ["import", "{", "export1", ",", "export2", "}", "from", "\"module-name\""], // 5
        ["import", "{", "export1", ",", "export2", "as", "alias2", "}", "from", "\"module-name\""], // 6
        ["import", "defaultExport", ",", "{", "export1", "}", "from", "\"module-name\""], // 7
        ["import", "defaultExport", ",", "*", "as", "name", "from", "\"module-name\""], // 8
        ["import", "\"module\""], // 9
        ["import", "myModule", ",", "{", "nameFunction", "}", "from", "\"./myModule\""], // 10
        ["import", "\"./style.css\""], // 11
        ["import", "assetURL", "from", "\"./asset.png\""], // 12
        ["import", "type", "{", "sometype", "}", "from", "\"../module\""], // 13
      ]
    });
  });


  it('Should analyze raw import statement to definition', function() {
    assert.deepEqual(analyzeRawImportStatement([]), null);
    assert.deepEqual(analyzeRawImportStatement(undefined), null);
    assert.deepEqual(analyzeRawImportStatement(["a", "random", "string", "array"]), null);
    assert.deepEqual(analyzeRawImportStatement(2), null);
    assert.deepEqual(analyzeRawImportStatement("import defaultExport from \"module-name\""), null);

    const { statements } = tokenizeImports(testString);

    assert.deepEqual(analyzeRawImportStatement(statements.at(0)), {
      module: "module-name",
      defaultImports: ["defaultExport"]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(1)), {
      module: "module-name-1",
      namespaceImports: ["name"]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(2)), {
      module: "module-name",
      namedImports: [{
        name: "export1"
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(3)), {
      module: "module-name",
      namedImports: [{
        name: "export1",
        alias: "alias1"
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(4)), {
      module: "module-name-2",
      namedImports: [{
        name: "default",
        alias: "alias"
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(5)), {
      module: "module-name",
      namedImports: [{
        name: "export1",
      }, {
        name: "export2",
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(6)), {
      module: "module-name",
      namedImports: [{
        name: "export1",
      }, {
        name: "export2",
        alias: "alias2"
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(7)), {
      module: "module-name",
      defaultImports: ["defaultExport"],
      namedImports: [{
        name: "export1",
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(8)), {
      module: "module-name",
      defaultImports: ["defaultExport"],
      namespaceImports: ["name"]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(9)), {
      module: "module"
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(10)), {
      module: "./myModule",
      defaultImports: ["myModule"],
      namedImports: [{
        name: "nameFunction"
      }]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(11)), {
      module: "./style.css"
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(12)), {
      module: "./asset.png",
      defaultImports: ["assetURL"]
    });

    assert.deepEqual(analyzeRawImportStatement(statements.at(13)), {
      module: "../module",
      type: true,
      namedImports: [{
        name: "sometype"
      }]
    });
  });



  it("Should merge import definition", function() {
    assert.deepEqual(mergeImportsDefinitions(undefined), null);
    assert.deepEqual(mergeImportsDefinitions("string"), null);
    assert.deepEqual(mergeImportsDefinitions(2), null);
    assert.deepEqual(mergeImportsDefinitions([]), new Map());

    const anotherTestString = `import defaultExport1, * as nsExport2 from "module"; import defaultExport2 from "module"
      import * as nsExport1 from "module"`;
    assert.deepEqual(mergeImportsDefinitions(tokenizeImports(anotherTestString).statements.map(statement => analyzeRawImportStatement(statement))), new Map([
      ["module", {
        defaultImports: new Set(["defaultExport1", "defaultExport2"]),
        namespaceImports: new Set(["nsExport1", "nsExport2"])
      }]
    ]));


    const { statements } = tokenizeImports(testString);
    const importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));

    assert.deepEqual(mergeImportsDefinitions(importsDefinitions), new Map([
      ["module-name", {
        defaultImports: new Set(["defaultExport"]),
        namespaceImports: new Set(["name"]),
        namedImports: [{
          name: "export1"
        }, {
          name: "export1",
          alias: "alias1"
        }, {
          name: "export2",
        }, {
          name: "export2",
          alias: "alias2"
        }]
      }], ["module-name-1", {
        namespaceImports: new Set(["name"])
      }
      ], ["module-name-2", {
        namedImports: [{
          name: "default",
          alias: "alias"
        }]
      }
      ], ["module", {}
      ], ["./myModule", {
        defaultImports: new Set(["myModule"]),
        namedImports: [{
          name: "nameFunction"
        }]
      }], ["./style.css", {}],
      ["./asset.png", {
        defaultImports: new Set(["assetURL"])
      }],
      ["../module", {
        type: true,
        namedImports: [{
          name: "sometype"
        }]
      }]
    ]))
  })

  it('Should convert import definition into async import', function() {
    assert.deepEqual(convertImportDefinitionToAsyncImport(undefined), null);
    assert.deepEqual(convertImportDefinitionToAsyncImport(2), null);

    assert.deepEqual(convertImportDefinitionToAsyncImport("string"), [`await import("string");`]);

    assert.deepEqual(convertImportDefinitionToAsyncImport("./myModule", {}, "", "fixModuleImportPath"), [`await import(fixModuleImportPath("./myModule", import.meta.url));`])
    assert.deepEqual(convertImportDefinitionToAsyncImport("./myModule", { defaultImports: ["defaultExport"] }, "intermediateModule"), [
      `const intermediateModule = await import("./myModule");`,
      `const defaultExport = intermediateModule.default;`
    ])

    const { statements } = tokenizeImports(testString);
    const importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));
    const mergedDefinition = mergeImportsDefinitions(importsDefinitions);

    assert.deepEqual(convertImportDefinitionToAsyncImport("module", mergedDefinition.get("module")), [`await import("module");`]);
    assert.deepEqual(convertImportDefinitionToAsyncImport("./myModule", mergedDefinition.get("./myModule")), [
      `const module0 = await import("./myModule");`,
      `const myModule = module0.default;`,
      `const { nameFunction } = module0;`
    ]);
    assert.deepEqual(convertImportDefinitionToAsyncImport("module-name-1", mergedDefinition.get("module-name-1")), [
      `const module0 = await import("module-name-1");`,
      `const name = module0;`
    ]);
    assert.deepEqual(convertImportDefinitionToAsyncImport("module-name-2", mergedDefinition.get("module-name-2")), [
      `const module0 = await import("module-name-2");`,
      `const alias = module0.default;`
    ]);
    assert.deepEqual(convertImportDefinitionToAsyncImport("module-name", mergedDefinition.get("module-name")), [
      `const module0 = await import("module-name");`,
      `const defaultExport = module0.default;`,
      `const name = module0;`,
      `const { export1 } = module0;`,
      `const alias1 = module0.export1;`,
      `const { export2 } = module0;`,
      `const alias2 = module0.export2;`,
    ]);

    assert.deepEqual(convertImportDefinitionToAsyncImport("./style.css", mergedDefinition.get("./style.css")), []);
    assert.deepEqual(convertImportDefinitionToAsyncImport("./asset.png", mergedDefinition.get("./asset.png")), [
      `const assetURL = "./asset.png";`
    ]);

    assert.deepEqual(convertImportDefinitionToAsyncImport("../module", mergedDefinition.get("../module")), [
      `import type { sometype } from "../module";`
    ]);
  })


  it('Should convert import statements to async imports', function() {
    const { statements } = tokenizeImports(testString);
    const importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));
    const mergedDefinition = mergeImportsDefinitions(importsDefinitions);

    const entries = Array.from(mergedDefinition.entries());
    const asyncImports = [];
    for (let i = 0; i < entries.length; i++) {

      const [moduleName, importDefinition] = entries[i];

      asyncImports.push(...convertImportDefinitionToAsyncImport(moduleName, importDefinition, "module" + i));
    }

    assert.deepEqual(asyncImports, [
      `const module0 = await import("module-name");`,
      `const defaultExport = module0.default;`,
      `const name = module0;`,
      `const { export1 } = module0;`,
      `const alias1 = module0.export1;`,
      `const { export2 } = module0;`,
      `const alias2 = module0.export2;`,
      `const module1 = await import("module-name-1");`,
      `const name = module1;`,
      `const module2 = await import("module-name-2");`,
      `const alias = module2.default;`,
      `await import("module");`,
      `const module4 = await import("./myModule");`,
      `const myModule = module4.default;`,
      `const { nameFunction } = module4;`,
      `const assetURL = \"./asset.png\";`,
      `import type { sometype } from "../module";`,
    ])
  });


  it('Should replace content in string', function() {
    assert.equal(replaceLines(0, 0, "// this is a comment", "// this is another comment"), "// this is another comment");
    assert.equal(replaceLines(1, 1, `// this is a comment
line 2
Don't touch line 3`, "swoop"), `// this is a comment
swoop
Don't touch line 3`);


    const { statements, lines } = tokenizeImports(testString);
    const importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));
    const mergedDefinition = mergeImportsDefinitions(importsDefinitions);

    const entries = Array.from(mergedDefinition.entries());
    const asyncImports = [];
    for (let i = 0; i < entries.length; i++) {

      const [moduleName, importDefinition] = entries[i];

      asyncImports.push(...convertImportDefinitionToAsyncImport(moduleName, importDefinition, "module" + i));
    }

    const updatedScript = replaceLines(lines[0], lines[1], testString, asyncImports.join(" "));

    const testStringLines = testString.split("\n");
    const updatedScriptLines = updatedScript.split("\n");

    assert.equal(updatedScriptLines.at(lines[0] + 1), "");
    assert.equal(updatedScriptLines.at(testStringLines.length - 1), testStringLines.at(-1));
  })


  it('Should convert external module import to async import', function() {
    const { statements } = tokenizeImports(testString2);
    const importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));
    const mergedDefinition = mergeImportsDefinitions(importsDefinitions);

    const entries = Array.from(mergedDefinition.entries());
    const asyncImports = [];
    for (let i = 0; i < entries.length; i++) {

      const [_, importDefinition] = entries[i];

      asyncImports.push(...convertImportDefinitionToAsyncImport("./externals.js", importDefinition, "externalModule" + i, undefined, true));
    }

    assert.deepEqual(asyncImports, [
      `const { externalModule0 } = await import("./externals.js");`,
      `const Module = externalModule0.default;`,
      `const { method1 } = externalModule0;`,
      `const { method2 } = externalModule0;`
    ])

  })


});
