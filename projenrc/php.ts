/** Configuration for a project that includes editing PHP files */

import { XmlFile } from "projen";
import type { NodeProject } from "projen/lib/javascript";
import { LintStaged } from "./git-hooks";
import { addPrettierPlugin } from "./prettier";
import { VsCodeExtensions, VsCodeSettings } from "./vscode";

export function configurePHP(project: NodeProject) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const previousPreSynthesize = project.preSynthesize;
  project.preSynthesize = () => {
    console.log("preSynthesize");
    if (typeof previousPreSynthesize === "function") {
      previousPreSynthesize.call(project);
    }
  };
  addPrettierPlugin(project, "@prettier/plugin-php");
  VsCodeSettings.of(project)?.add({
    "[php]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
    },
    "prettier.documentSelectors": ["**/*.php"],
  });
  VsCodeExtensions.of(project)?.addToWorkspaceRecommendation(
    "getpsalm.psalm-vscode-plugin",
    "zobo.php-intellisense",
    "xdebug.php-debug",
  );
  LintStaged.of(project)?.addRule("*.php", [
    /** @see {@link https://psalm.dev/docs/manipulating_code/fixing/} */
    "./vendor/bin/psalter --issues=all",
    "prettier --write",
  ]);
  new XmlFile(project, "psalm.xml", {
    readonly: true,
    obj: {
      psalm: {
        "@xmlns": "https://getpsalm.org/schema/config",
        "@xsi:schemaLocation":
          "https://getpsalm.org/schema/config  vendor/vimeo/psalm/config.xsd",
        "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "@phpVersion": "8.0.25",
        "@useDocblockTypes": true,
        "@resolveFromConfigFile": true,
        "@findUnusedVariablesAndParams": true,
        "@findUnusedCode": true,
        "@findUnusedPsalmSuppress": true,
        "@runTaintAnalysis": true,
        /** @see {@link https://psalm.dev/docs/running_psalm/error_levels/} */
        "@errorLevel": 4,
        projectFiles: [
          {
            directory: [
              {
                "@name": "src" /* FIXME we should get that from project */,
              },
            ],
            ignoreFiles: [{ directory: { "@name": "vendor" } }],
          },
        ],
        plugins: {
          pluginClass: [
            {
              "@class": "PsalmWordPress\\Plugin",
            },
            { "@class": "AlexS\\Guzzle\\PsalmPlugin" },
            { "@class": "Psalm\\PhpUnitPlugin\\Plugin" },
          ],
        },
      },
    },
    omitEmpty: true,
  });
  project.addGitIgnore("vendor");
  // composer require --dev vimeo/psalm
  // composer require --dev humanmade/psalm-plugin-wordpress
  // composer require --dev alexeyshockov/guzzle-psalm-plugin
  // composer require --dev psalm/plugin-phpunit
  // composer require --dev bref/bref guzzlehttp/guzzle aws/aws-sdk-php
}
