import { build } from "esbuild";
import path, { dirname, resolve } from "path";
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
  assetDir,
  publicPath,
  bundleName,
  moduleResolverWrapperFunction
}, modulesFlatTree = {}, externalModules = [], cssFiles = [], assetFiles = []) {
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

          if (!modulesFlatTree[entrypoint].imports) {
            modulesFlatTree[entrypoint].imports = new Set();
          }

          const buildPromises = [];
          for (let i = 0; i < entries.length; i++) {
            let [moduleName, importDefinition] = entries[i];

            // node_modules
            if (!moduleName.startsWith(".")) {
              if (moduleName.endsWith(".css") && fs.existsSync(`./node_modules/${moduleName}`)) {
                cssFiles.push(`./node_modules/${moduleName}`);
                continue;
              }

              modulesFlatTree[entrypoint].imports.add(moduleName);

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
            modulesFlatTree[entrypoint].imports.add(moduleRelativePathToProject);

            moduleName += extension;

            // CSS or asset file
            if (![".js", ".jsx", ".mjs", ".ts", ".tsx"].find(ext => moduleName.endsWith(ext))) {

              if (!modulesFlatTree[moduleRelativePathToProject]) {
                modulesFlatTree[moduleRelativePathToProject] = {}
              }

              if (!modulesFlatTree[moduleRelativePathToProject].parents)
                modulesFlatTree[moduleRelativePathToProject].parents = []

              modulesFlatTree[moduleRelativePathToProject].parents.push(entrypoint);

              if (moduleName.endsWith(".css")) {
                cssFiles.push(moduleRelativePathToProject);
              } else {

                const pathSplitAtSlash = moduleRelativePathToProject.split("/");
                const assetFileName = pathSplitAtSlash.pop();

                const assetFileNameSplitAtDots = assetFileName.split(".");
                const extension = assetFileNameSplitAtDots.pop();

                const uniqName = `${assetFileNameSplitAtDots.join(".")}-${randomStr(5)}.${extension}`

                assetFiles.push({
                  assetPath: moduleRelativePathToProject,
                  uniqName
                });

                modulesFlatTree[moduleRelativePathToProject].assetName = uniqName;

                pathSplitAtSlash.push(uniqName);

                asyncImports.push(...convertImportDefinitionToAsyncImport(moduleRelativePathToProject, importDefinition, null, moduleResolverWrapperFunction));
              }

              continue;
            }


            if (recurse) {
              buildPromises.push(builder({
                entrypoint: moduleRelativePathToProject,
                recurse,
                outdir,
                convertExternalModules,
                bundleName,
                assetDir,
                publicPath,
                useModuleProjectPaths,
                moduleResolverWrapperFunction
              }, modulesFlatTree, externalModules, cssFiles, assetFiles));
            }

            if (!modulesFlatTree[moduleRelativePathToProject]) {
              modulesFlatTree[moduleRelativePathToProject] = {}
            }

            if (!modulesFlatTree[moduleRelativePathToProject].parents)
              modulesFlatTree[moduleRelativePathToProject].parents = []

            modulesFlatTree[moduleRelativePathToProject].parents.push(entrypoint);

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

  return { modulesFlatTree, externalModules, cssFiles, assetFiles }
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
    plugins: [{
      name: "delete-temp-file",
      setup(build) {
        build.onEnd(() => fs.rmSync(intermediateFile))
      }
    }]
  });
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
    outfile: intermediateOutJSFile,
    plugins: [{
      name: "copy-files",
      setup(build) {
        build.onEnd(() => {
          fs.renameSync(intermediateOutCSSFile, outCssFile);
          fs.rmSync(intermediateJSFile);
          fs.rmSync(intermediateOutJSFile);
        })
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
  assetDir = "assets",
  publicPath = "/",
  externalModules: {
    convert,
    bundle,
    bundleOutName = "externals.js",
    bundleClientName = "/" + bundleOutName
  }
}) {
  const { modulesFlatTree, externalModules, cssFiles, assetFiles } = await builder({
    entrypoint,
    outdir,
    recurse,
    useModuleProjectPaths,
    moduleResolverWrapperFunction,
    assetDir,
    publicPath,
    convertExternalModules: convert,
    bundleName: bundleClientName
  });

  const entrypointDir = dirname(entrypoint);
  const mainOutDir = resolve(outdir, entrypointDir);

  if (bundle) {
    await bundleExternalModules(externalModules, mainOutDir, bundleOutName);
  }

  if (cssFiles.length) {
    await bundleCSSFiles(cssFiles, mainOutDir, "index.css")
  }

  if (assetFiles.length) {
    const assetDirectory = resolve(mainOutDir, assetDir);
    if (!fs.existsSync(assetDirectory)) fs.mkdirSync(assetDirectory, { recursive: true });
    assetFiles.forEach(asset => {
      modulesFlatTree[asset.assetPath].out = resolve(assetDirectory, asset.uniqName);
      fs.copyFileSync(asset.assetPath, resolve(assetDirectory, asset.uniqName));
    })
  }

  return { modulesFlatTree, cssFiles, assetFiles }
}
