import { build } from "esbuild";
import { dirname, resolve } from "path";
import fs from "fs";
import {
  analyzeRawImportStatement, convertImportDefinitionToAsyncImport,
  mergeImportsDefinitions, replaceLines, tokenizeImports
} from "../importsParser.js";

export function getModulePathExtension(modulePath) {
  return ["",
    "x", ".js", ".jsx", ".mjs", ".ts", ".tsx",
    "/index.js", "/index.jsx", "./index.mjs", "/index.ts", "/index.tsx"
  ].find(ext => fs.existsSync(modulePath + ext) && fs.statSync(modulePath + ext).isFile());
}

export async function builder({
  entrypoint,
  recurse,
  outdir = "dist",
  useModuleProjectPaths,
  convertExternalModules,
  bundleName,
  moduleResolverWrapperFunction
}, modulesFlatTree = {}, externalModules = [], cssFiles = []) {
  entrypoint = entrypoint + getModulePathExtension(entrypoint);

  const currentDir = dirname(entrypoint);

  if (!modulesFlatTree[entrypoint]) {
    modulesFlatTree[entrypoint] = {}
  }

  await build({
    entryPoints: [entrypoint],
    outdir: resolve(process.cwd(), outdir, currentDir),
    format: "esm",
    allowOverwrite: true,
    assetNames: '[name]',
    plugins: [{
      name: "recursive-builder",
      setup(build) {

        build.onLoad({ filter: /.*/ }, async ({ path }) => {
          const contents = fs.readFileSync(path).toString();

          const importStatements = tokenizeImports(contents);

          const statements = importStatements?.statements ?? [];
          const lines = importStatements?.lines ?? [undefined, undefined];

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

            // node_modules
            if (!moduleName.startsWith(".")) {

              if (convertExternalModules) {

                if (!externalModules.includes(moduleName))
                  externalModules.push(moduleName)

                const indexOfExternalModule = externalModules.indexOf(moduleName);

                asyncImports.push(...convertImportDefinitionToAsyncImport(bundleName, importDefinition, "externalModule" + indexOfExternalModule, undefined, true));

              }

              continue;
            }

            let moduleRelativePathToProject = resolve(currentDir, moduleName).replace(process.cwd(), ".");
            const extension = getModulePathExtension(moduleRelativePathToProject);

            moduleRelativePathToProject += extension;
            moduleName += extension;

            // CSS or asset file
            if (![".js", ".jsx", ".mjs", ".ts", ".tsx"].find(ext => moduleName.endsWith(ext))) {
              if (moduleName.endsWith(".css")) {
                if (!modulesFlatTree[moduleRelativePathToProject]) {
                  modulesFlatTree[moduleRelativePathToProject] = {}
                }

                if (!modulesFlatTree[moduleRelativePathToProject].parents)
                  modulesFlatTree[moduleRelativePathToProject].parents = []

                modulesFlatTree[moduleRelativePathToProject].parents.push(entrypoint);

                cssFiles.push(moduleRelativePathToProject);
                continue;
              }

              return {
                contents,
                loader: "file"
              }
            }


            if (recurse) {
              buildPromises.push(builder({
                entrypoint: moduleRelativePathToProject,
                recurse,
                outdir,
                convertExternalModules,
                bundleName,
                useModuleProjectPaths,
                moduleResolverWrapperFunction
              }, modulesFlatTree, externalModules, cssFiles));

              if (!modulesFlatTree[moduleRelativePathToProject]) {
                modulesFlatTree[moduleRelativePathToProject] = {}
              }

              if (!modulesFlatTree[moduleRelativePathToProject].parents)
                modulesFlatTree[moduleRelativePathToProject].parents = []

              modulesFlatTree[moduleRelativePathToProject].parents.push(entrypoint);
            }

            asyncImports.push(...convertImportDefinitionToAsyncImport(useModuleProjectPaths ? moduleRelativePathToProject : moduleName, importDefinition, "module" + i, moduleResolverWrapperFunction));
          }

          await Promise.all(buildPromises);

          return {
            contents: replaceLines(lines[0], lines[1], contents, asyncImports.join(" ")),
            loader: path.endsWith(".ts")
              ? "ts"
              : path.endsWith(".jsx") || path.endsWith(".tsx")
                ? "jsx"
                : "js"
          }
        });
      }
    }]
  })

  return { modulesFlatTree, externalModules, cssFiles }
}

function randomStr(length = 10) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export async function bundleExternalModules(modulesList, outdir, bundleName) {
  const intermediateFile = `./${randomStr()}.js`;
  fs.writeFileSync(intermediateFile, modulesList.map((moduleName, i) => `export * as externalModule${i} from "${moduleName}";`).join('\n'));
  await build({
    entryPoints: [intermediateFile],
    format: "esm",
    allowOverwrite: true,
    bundle: true,
    outfile: resolve(process.cwd(), outdir, bundleName),
  });
  fs.rmSync(intermediateFile)
}

export async function bundleCSSFiles(modulesList, outdir, bundleName) {
  const intermediateJSFile = `./${randomStr()}.js`;
  const intermediateOutJSFile = resolve(process.cwd(), outdir, intermediateJSFile);
  const intermediateOutCSSFile = intermediateOutJSFile.slice(0, -3) + ".css";
  const outCssFile = resolve(process.cwd(), outdir, bundleName);
  fs.writeFileSync(intermediateJSFile, modulesList.map((moduleName) => `import "${moduleName}";`).join('\n'));
  await build({
    entryPoints: [intermediateJSFile],
    format: "esm",
    allowOverwrite: true,
    bundle: true,
    outfile: intermediateOutJSFile
  });
  fs.renameSync(intermediateOutCSSFile, outCssFile);
  fs.rmSync(intermediateJSFile);
  fs.rmSync(intermediateOutJSFile);
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
  const { modulesFlatTree, externalModules, cssFiles } = await builder({
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
  if (cssFiles.length) {
    await bundleCSSFiles(cssFiles, bundleOutdir, "index.css")
  }
  return { modulesFlatTree, cssFiles }
}
