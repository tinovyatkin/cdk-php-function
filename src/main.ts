import type { StackProps } from "aws-cdk-lib";
import { App, Stack } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { WordpressServerless } from "./serverless-wordpress";

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    new WordpressServerless(this, "Wordpress");
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, "wordpress-serverless-dev", { env: devEnv });

app.synth();
