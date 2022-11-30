import type { GitHubOptions } from "projen/lib/github";
import type { NodeProject } from "projen/lib/javascript";
import { VsCodeExtensions } from "./vscode";

// cspell:word mergify

export const githubOptions: GitHubOptions = {
  mergify: false,
  pullRequestLint: false,
};

export function configureGitHubIntegration(project: NodeProject) {
  VsCodeExtensions.of(project)?.addToWorkspaceRecommendation(
    "github.vscode-pull-request-github",
  );
  if (!project.github) return;
}
