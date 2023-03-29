import { build } from "esbuild";
import { dirname, resolve } from "path";
import fs from "fs";
import {
  analyzeRawImportStatement, convertImportDefinitionToAsyncImport,
  mergeImportsDefinitions, replaceLines, tokenizeImports
} from "./importsParser.js";

export function getModulePathExtension(modulePath) {
  return ["", "x", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx", "/index.ts", "/index.tsx"]
    .find(ext => fs.existsSync(modulePath + ext) && fs.statSync(modulePath + ext).isFile());
}

export async function builder({
  entrypoint,
  recurse,
  outdir = "dist",
  useModuleProjectPaths,
  convertExternalModules,
  bundleName,
  moduleResolverWrapperFunction
}, modulesFlatTree = {}, externalModules = []) {
  entrypoint = entrypoint + getModulePathExtension(entrypoint);

  const currentDir = dirname(entrypoint);

  const isJSX = entrypoint.endsWith("x");
  const safeJSFilePath = isJSX ? entrypoint.slice(0, -1) : entrypoint;
  if (!modulesFlatTree[safeJSFilePath]) {
    modulesFlatTree[safeJSFilePath] = {
      jsx: isJSX
    }
  }

  await build({
    entryPoints: [entrypoint],
    outdir: resolve(process.cwd(), outdir, currentDir),
    format: "esm",
    allowOverwrite: true,
    plugins: [{
      name: "recursive-builder",
      setup(build) {

        build.onLoad({ filter: /.*/ }, async ({ path }) => {
          const contents = fs.readFileSync(path).toString();

          const { statements, lines } = tokenizeImports(contents);

          const asyncImports = [];
          let importsDefinitions = statements.map(statement => analyzeRawImportStatement(statement));

          if (!convertExternalModules) {
            importsDefinitions = importsDefinitions.filter((importDef, index) => {
              if (importDef.module.startsWith(".")) return true;
              asyncImports.push(statements[index].join(" ") + ";");
              return false;
            })
          }

          const mergedDefinition = mergeImportsDefinitions(importsDefinitions);
          const entries = Array.from(mergedDefinition.entries());

          const buildPromises = [];
          for (let i = 0; i < entries.length; i++) {
            let [moduleName, importDefinition] = entries[i];

            if (!moduleName.startsWith(".") && convertExternalModules) {

              if (!externalModules.includes(moduleName))
                externalModules.push(moduleName)

              const indexOfExternalModule = externalModules.indexOf(moduleName);

              asyncImports.push(...convertImportDefinitionToAsyncImport(bundleName, importDefinition, "externalModule" + indexOfExternalModule, undefined, true));
              continue;
            }

            let moduleRelativePathToProject = resolve(currentDir, moduleName).replace(process.cwd(), ".");
            const extension = getModulePathExtension(moduleRelativePathToProject);

            moduleRelativePathToProject += extension;
            moduleName += extension;

            const isJSX = moduleName.endsWith("x");

            moduleRelativePathToProject = isJSX ? moduleRelativePathToProject.slice(0, -1) : moduleRelativePathToProject;
            moduleName = isJSX ? moduleName.slice(0, -1) : moduleName;

            if (recurse) {
              buildPromises.push(builder({
                entrypoint: moduleRelativePathToProject,
                recurse,
                outdir,
                convertExternalModules,
                bundleName
              }, modulesFlatTree, externalModules));

              if (!modulesFlatTree[moduleRelativePathToProject]) {
                modulesFlatTree[moduleRelativePathToProject] = {
                  jsx: isJSX
                }
              }

              if (!modulesFlatTree[moduleRelativePathToProject].parents)
                modulesFlatTree[moduleRelativePathToProject].parents = []

              modulesFlatTree[moduleRelativePathToProject].parents.push(safeJSFilePath);
            }

            asyncImports.push(...convertImportDefinitionToAsyncImport(useModuleProjectPaths ? moduleRelativePathToProject : moduleName, importDefinition, "module" + i, moduleResolverWrapperFunction));
          }

          await Promise.all(buildPromises);

          return {
            contents: replaceLines(lines[0], lines[1], contents, asyncImports.join(" ")),
            loader: path.endsWith(".jsx")
              ? "jsx"
              : "js"
          }
        });
      }
    }]
  })

  return { modulesFlatTree, externalModules }
}

export function bundleExternalModules(modulesList, outdir, bundleName) {
  fs.writeFileSync("./empty.js", "");
  return build({
    entryPoints: ['./empty.js'],
    format: "esm",
    allowOverwrite: true,
    bundle: true,
    outfile: resolve(process.cwd(), outdir, bundleName),
    plugins: [{
      name: "recursive-builder",
      setup(build) {
        build.onLoad({ filter: /\/empty\.js/ }, async () => {
          return { contents: modulesList.map((moduleName, i) => `export * as externalModule${i} from "${moduleName}";`).join('\n') }
        });
        build.onEnd(() => fs.rmSync("./empty.js"))
      }
    }]
  });
}

export default async function({
  entrypoint,
  outdir = "dist",
  recurse,
  useModuleProjectPaths = false,
  moduleResolverWrapperFunction,
  externalModules: {
    convert,
    bundle,
    bundleOutdir = outdir,
    bundleOutName = "externals.js",
    bundleClientName = "/" + bundleOutName
  }
}) {
  const { modulesFlatTree, externalModules } = await builder({
    entrypoint,
    outdir,
    recurse,
    useModuleProjectPaths,
    moduleResolverWrapperFunction,
    convertExternalModules: convert,
    bundleName: bundleClientName
  });
  if (bundle) {
    await bundleExternalModules(externalModules, bundleOutdir, bundleOutName);
  }
  return modulesFlatTree
}
