import type { javascript } from "projen";
import type { NodeProject } from "projen/lib/javascript";
import { TrailingComma } from "projen/lib/javascript";
import type { TypeScriptProject } from "projen/lib/typescript";
import { LintStaged } from "./git-hooks";
import { VsCodeExtensions, VsCodeSettings } from "./vscode";

const PLUGINS = [
  "prettier-plugin-organize-imports",
  "prettier-plugin-organize-attributes",
  "prettier-plugin-jsdoc",
  "@prettier/plugin-xml",
];

export const prettierOptions: javascript.PrettierOptions = {
  settings: {
    trailingComma: TrailingComma.ALL,
    plugins: [],
    // @ts-expect-error not supported by projen yet
    singleAttributePerLine: true,
    tsdoc: true,
    jsdocVerticalAlignment: true,
    jsdocSeparateReturnsFromParam: true,
    jsdocSeparateTagGroups: true,
    jsdocPreferCodeFences: true,
  },
  overrides: [
    {
      files: ["*.svg"],
      // @ts-expect-error broken types
      options: {
        parser: "xml",
        xmlWhitespaceSensitivity: "ignore",
      },
    },
  ],
};

export function addPrettierPlugin(project: NodeProject, plugin: string) {
  if (!project.prettier) return;
  // @ts-expect-error setting readonly property
  project.prettier.settings.plugins ??= [];
  if (project.prettier.settings.plugins.some((p) => p.endsWith(plugin))) return;
  project.addDevDeps(plugin);
  // adding with ./node_modules to be compatible with monorepos
  project.prettier.settings.plugins.push(`./node_modules/${plugin}`);
}

export function configurePrettier(project: TypeScriptProject) {
  if (!project.prettier) return;

  for (const plugin of PLUGINS) addPrettierPlugin(project, plugin);

  if (project.eslint) {
    project.addDevDeps(
      "eslint-config-prettier",
      "eslint-config-prettier-jsdoc",
    );
    // removing unwanted plugins
    const eslintPlugins: string[] = project.eslint.config.plugins();
    const pluginPrettierIndex = eslintPlugins.findIndex(
      (v) => v === "prettier",
    );
    if (pluginPrettierIndex >= 0) {
      eslintPlugins.splice(pluginPrettierIndex);
      project.deps.removeDependency("eslint-plugin-prettier");
    }

    // we adding after ESLint config so expect them to be the last as it should
    const eslintExtends: string[] = project.eslint.config.extends();
    for (let i = eslintExtends.length - 1; i >= 0; i--)
      if (eslintExtends[i].includes("prettier")) eslintExtends.splice(i);
    project.eslint.addExtends("prettier", "prettier-jsdoc");
  }

  // cspell:word mjml
  LintStaged.of(project)?.addRule(
    "*.{ts,tsx,js,jsx,mjs,css,json,md,yaml,graphql,mjml,svg}",
    "prettier --write",
  );

  /** @see {@link https://github.com/prettier/prettier-vscode} */
  VsCodeExtensions.of(project)?.addToWorkspaceRecommendation(
    "esbenp.prettier-vscode",
  );
  VsCodeSettings.of(project)?.add({
    "editor.codeActionsOnSave": {
      "source.organizeImports": true,
    },
    "editor.formatOnSave": true,
    "[json]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[jsonc]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[yaml]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[typescript]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[javascript]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[svg]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "[xml]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "prettier.documentSelectors": ["**/*.svg"],
  });
}
