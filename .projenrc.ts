import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Konstantin Vyatkin',
  authorAddress: 'tino@vtkn.io',
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-php-function',
  projenrcTs: true,
  repositoryUrl: 'git@github.com:tinovyatkin/cdk-php-function.git',

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();