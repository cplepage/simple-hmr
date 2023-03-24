import { build } from "esbuild";
import { dirname, resolve } from "path";
import fs from "fs";

async function buildExternalModules(modulesList) {
  await build({
    entryPoints: ['./empty.js'],
    format: "esm",
    allowOverwrite: true,
    bundle: true,
    outfile: './dist/client/externals.js',
    plugins: [{
      name: "recursive-builder",
      setup(build) {
        build.onLoad({ filter: /\/empty\.js/ }, async () => {
          return { contents: modulesList.map((moduleName, i) => `export * as externalModule${i} from "${moduleName}";`).join('\n') }
        });
      }
    }]
  });
}

async function recursiveBuilder(entrypoint, flatTree = {}, externalModules = []) {
  const currentDir = dirname(entrypoint);

  if (!flatTree[entrypoint]) {
    flatTree[entrypoint] = {
      jsx: entrypoint.endsWith("x")
    }
  }

  await build({
    entryPoints: [entrypoint],
    outdir: currentDir.replace(process.cwd(), "./").replace(/^\.\//, "dist/"),
    format: "esm",
    allowOverwrite: true,
    plugins: [{
      name: "recursive-builder",
      setup(build) {

        build.onLoad({ filter: /.*/ }, async ({ path }) => {
          let content = fs.readFileSync(path).toString();


          const imports = content.match(/import(.|\t|\n|\r)*?".*";?/g);
          if (imports) {
            await Promise.all(imports.map((importStatement, index) => {
              const modulePathRelativeToCurrent = importStatement.match(/".*"/).at(0).slice(1, -1).trim();

              // node_modules
              if (!modulePathRelativeToCurrent.startsWith(".")) {
                if (!externalModules.includes(modulePathRelativeToCurrent))
                  externalModules.push(modulePathRelativeToCurrent);

                const externalModuleIndex = externalModules.indexOf(modulePathRelativeToCurrent);

                const externalImportModuleName = `externalModule${externalModuleIndex}`;
                let externalImport = `import { ${externalImportModuleName} } from "/externals.js";`;

                const importations = importStatement.match(/import.*?from/);
                if (importations) {
                  const isolated = importations.at(0).slice(6, -4).trim();

                  isolated.split(",").forEach(groupImport => {
                    groupImport = groupImport.trim();

                    if (!groupImport.startsWith("{")) {
                      // import defaultExport from "module-name";
                      // import * as name from "module-name";
                      // import defaultExport, * as name from "module-name";

                      groupImport.split(",").forEach(singleImport => {
                        singleImport = singleImport.trim();

                        // default import
                        if (!singleImport.includes("as")) {
                          externalImport += `const ${singleImport} = ${externalImportModuleName};`;
                        } else {
                          // import * as name from "module-name";

                          const name = singleImport.split("as").pop().trim();
                          externalImport += `const ${name} = ${externalImportModuleName};`;
                        }
                      });


                    } else {
                      // import { export1 } from "module-name";
                      // import { export1 as alias1 } from "module-name";
                      // import { default as alias } from "module-name";
                      // import { export1, export2 } from "module-name";
                      // import { export1, export2 as alias2, /* … */ } from "module-name";
                      // import { "string name" as alias } from "module-name";

                      groupImport = groupImport.slice(1, -1);

                      groupImport.split(",").forEach(singleImport => {
                        singleImport = singleImport.trim();

                        // basic named import
                        if (!singleImport.includes("as")) {
                          externalImport += `const {${singleImport}} = ${externalImportModuleName};`;
                        }

                      })

                    }

                  });
                }

                content = content.replace(importStatement, externalImport);
                return;
              };

              let modulePath = modulePathRelativeToCurrent.replace(/^\.\//, currentDir + "/");

              if (!fs.existsSync(modulePath)) {
                const extension = [".js", ".jsx", ".ts", ".tsx"].filter(ext => fs.existsSync(modulePath + ext));
                modulePath += extension.at(0);
              }

              const importations = importStatement.match(/import.*?from/);
              if (importations) {
                const isolated = importations.at(0).slice(6, -4).trim();

                let hmrImport = `const module${index} = await import(window.getModuleImportPath("${modulePath}"));`;
                isolated.split(",").forEach(groupImport => {
                  groupImport = groupImport.trim();

                  if (!groupImport.startsWith("{")) {
                    // import defaultExport from "module-name";
                    // import * as name from "module-name";
                    // import defaultExport, * as name from "module-name";

                    groupImport.split(",").forEach(singleImport => {
                      singleImport = singleImport.trim();

                      // default import
                      if (!singleImport.includes("as")) {
                        hmrImport += `const ${singleImport} = module${index}.default;`;
                      } else {
                        // import * as name from "module-name";

                        const name = singleImport.split("as").pop().trim();
                        hmrImport += `const ${name} = module${index}`;
                      }
                    });


                  } else {
                    // import { export1 } from "module-name";
                    // import { export1 as alias1 } from "module-name";
                    // import { default as alias } from "module-name";
                    // import { export1, export2 } from "module-name";
                    // import { export1, export2 as alias2, /* … */ } from "module-name";
                    // import { "string name" as alias } from "module-name";

                    groupImport = groupImport.slice(1, -1);

                    groupImport.split(",").forEach(singleImport => {
                      singleImport = singleImport.trim();

                      // basic named import
                      if (!singleImport.includes("as")) {
                        hmrImport += `const {${singleImport}} = module${index};`;
                      }

                    })

                  }

                });


                content = content.replace(importStatement, hmrImport);
              } else {

                // side-effect import
                content = content.replace(importStatement, `await import(window.getModuleImportPath("${modulePath}"));`);
              }

              if (!flatTree[modulePath]) {
                flatTree[modulePath] = {
                  jsx: modulePath.endsWith("x")
                }
              }

              if (!flatTree[modulePath].parents)
                flatTree[modulePath].parents = []

              flatTree[modulePath].parents.push(entrypoint);

              return recursiveBuilder(modulePath, flatTree, externalModules);
            }))
          }

          return {
            contents: content,
            loader: path.endsWith(".jsx")
              ? "jsx"
              : "js"
          }
        });
      }
    }]
  })

  return { flatTree, externalModules }
}

export default async function(entrypoint, init) {
  const { flatTree, externalModules } = await recursiveBuilder(entrypoint);
  if (init)
    await buildExternalModules(externalModules)
  return flatTree;
}
