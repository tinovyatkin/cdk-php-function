import type { Project } from "projen";
import { JsonFile } from "projen";
import type { NodeProject } from "projen/lib/javascript";
import { deepMerge, exec, execCapture } from "projen/lib/util";

export class VsCodeSettings extends JsonFile {
  static readonly #fileName = ".vscode/settings.json";

  public static of(project: Project): VsCodeSettings | undefined {
    return project.tryFindObjectFile(VsCodeSettings.#fileName) as
      | VsCodeSettings
      | undefined;
  }

  constructor(
    project: NodeProject,
    private readonly settings: Record<string, unknown> = {},
  ) {
    super(project, VsCodeSettings.#fileName, {
      obj: () => this.settings,
      marker: true,
      newline: true,
    });
  }

  add(settings: Record<string, unknown>) {
    deepMerge([this.settings, settings], true);
  }
}

export class VsCodeExtensions extends JsonFile {
  static readonly #fileName = ".vscode/extensions.json";

  public static of(project: Project): VsCodeExtensions | undefined {
    return project.tryFindObjectFile(VsCodeExtensions.#fileName) as
      | VsCodeExtensions
      | undefined;
  }

  constructor(
    project: NodeProject,
    private readonly recommendations: string[] = [],
    private readonly unwantedRecommendations: string[] = [],
  ) {
    super(project, VsCodeExtensions.#fileName, {
      obj: () => ({
        recommendations: this.recommendations.sort(),
        unwantedRecommendations: this.unwantedRecommendations.sort(),
      }),
      marker: false,
      newline: true,
      readonly: true,
    });
  }

  addToWorkspaceRecommendation(...extensions: string[]) {
    this.recommendations.push(...extensions);
  }

  addToUnwantedRecommendations(...extensions: string[]) {
    this.unwantedRecommendations.push(...extensions);
  }

  postSynthesize(): void {
    // installing missing recommended extensions
    if (this.recommendations.length) {
      // check if VSCode CLI is installed
      try {
        const installedExtensions: ReadonlySet<string> = new Set(
          execCapture("code --list-extensions", {
            cwd: this.project.outdir,
          })
            .toString("utf-8")
            .trim()
            .toLowerCase()
            .split(/\n+/g),
        );
        for (const extension of this.recommendations) {
          if (
            !installedExtensions.has(extension.split("@", 1)[0].toLowerCase())
          )
            exec(`code --install-extension ${extension} --force`, {
              cwd: this.project.outdir,
            });
        }
      } catch {}
    }
  }
}

export function configureVSCode(project: NodeProject) {
  // settings file
  new VsCodeSettings(project, {
    "typescript.tsdk": "node_modules/typescript/lib",
    "json.schemaDownload.enable": true,
    "php.suggest.basic": false,
  });

  // recommended extensions
  new VsCodeExtensions(
    project,
    ["amazonwebservices.aws-toolkit-vscode", "Quidgest.vscode-velocity"],
    [
      "DavidAnson.vscode-markdownlint",
      "GoogleCloudTools.cloudcode",
      "ms-kubernetes-tools.vscode-kubernetes-tools",
    ],
  );
}
