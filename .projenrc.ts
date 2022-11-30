// cspell:words awscdk, tinovyatkin, Konstantin Vyatkin, projenrc
import { awscdk } from "projen";
import { NodePackageManager, NpmConfig } from "projen/lib/javascript";

import { configureCSpell } from "./projenrc/cspell";
import { configureESLint, eslintOptions } from "./projenrc/eslint";
import { configureGitHooks } from "./projenrc/git-hooks";
import { configureGitHubIntegration, githubOptions } from "./projenrc/github";
import { configureJest, jestOptions } from "./projenrc/jest";
import { configurePHP } from "./projenrc/php";
import { configurePrettier, prettierOptions } from "./projenrc/prettier";
import { configureVSCode } from "./projenrc/vscode";

const project = new awscdk.AwsCdkTypeScriptApp({
  defaultReleaseBranch: "main",
  name: "cdk-php-function",
  projenrcTs: true,
  cdkVersion: "2.50.0",
  constructsVersion: "10.1.145",
  projenVersion: "0.65.8",
  minNodeVersion: "16.18.0",
  packageManager: NodePackageManager.NPM,

  githubOptions,
  jestOptions,
  eslintOptions,
  prettier: true,
  prettierOptions,
  vscode: true,

  devDeps: ["aws-cdk"],

  tsconfig: {
    compilerOptions: {
      target: "es2022",
      lib: ["ES2022"],
      noEmit: true,
      skipLibCheck: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"],
        "~/*": ["./*"],
      },
    },
  },
});

// Add generated files to prettier ignore
project.prettier?.ignoreFile?.addPatterns(
  ".eslintrc.json",
  ".github/pull_request_template.md",
  ".vscode/settings.json",
  "cdk.json",
  ".prettierrc.json",
  "tsconfig.*",
);
project.gitignore.addPatterns(".DS_Store");

// Add ts-node settings to tsconfig
project.addDevDeps("tsconfig-paths");
for (const tsconfig of [project.tsconfig, project.tsconfigDev]) {
  tsconfig?.file.addOverride("ts-node", {
    preferTsExts: true,
    require: ["tsconfig-paths/register"],
  });
}

// Creating .npmrc, cspell:words npmrc, loglevel
const npmrc = new NpmConfig(project);
npmrc.addConfig("audit", "false");
npmrc.addConfig("fund", "false");
npmrc.addConfig("loglevel", "error");
npmrc.addConfig("engine-strict", "true");
npmrc.addConfig("send-metrics", "false");
npmrc.addConfig("legacy-peer-deps", "true");
npmrc.addConfig("yes", "true");

configureGitHooks(project); // should be on top as other extends lint-staged config
configureGitHubIntegration(project);
configureCSpell(project);
configureVSCode(project);
configureESLint(project);
configurePrettier(project);
configureJest(project);
configurePHP(project);

project.synth();
