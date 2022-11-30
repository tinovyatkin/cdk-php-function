import type { Project } from "projen";
import { JsonFile } from "projen";
import type { NodeProject } from "projen/lib/javascript";
import { LintStaged } from "./git-hooks";
import { VsCodeExtensions } from "./vscode";

export class CSpell extends JsonFile {
  static readonly #fileName = "cspell.json";

  public static of(project: Project): CSpell | undefined {
    return project.tryFindObjectFile(CSpell.#fileName) as CSpell | undefined;
  }

  constructor(
    project: NodeProject,
    private readonly settings: Record<string, unknown> = {},
  ) {
    super(project, CSpell.#fileName, {
      obj: () => ({
        version: "0.2",
        enabled: true,
        ...this.settings,
      }),
      marker: false,
      readonly: false,
      newline: true,
    });
  }

  addWords(...words: string[]) {
    const w = new Set<string>(
      (this.settings.words as string[] | undefined) ?? [],
    );
    words.forEach((word) => w.add(word));
    this.settings.words = [...w].sort();
  }
}

export function configureCSpell(project: NodeProject) {
  project.addDevDeps("cspell");
  VsCodeExtensions.of(project)?.addToWorkspaceRecommendation(
    "streetsidesoftware.code-spell-checker",
  );
  LintStaged.of(project)?.addRule(
    "*.{ts,tsx,md}",
    "cspell --no-must-find-files --no-summary",
  );
  new CSpell(project, {
    dictionaries: ["typescript", "aws", "node", "npm", "html"],
    enabledLanguageIds: [
      "typescript",
      "typescriptreact",
      "markdown",
      "velocity",
      "javascript",
    ],
    words: ["projen"],
  });
}
