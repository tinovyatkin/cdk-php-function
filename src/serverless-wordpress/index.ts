/**
 * @see {@link https://docs.aws.amazon.com/whitepapers/latest/best-practices-wordpress/welcome.html}
 * @see {@link https://github.com/aws-samples/aws-refarch-wordpress}
 * @see {@link https://github.com/aaronbrighton/cdk-serverless-php-mpa}
 * @see {@link https://github.com/aaronbrighton/cdk-serverless-wordpress}
 * @see {@link https://github.com/aws-samples/cdk-serverless-wordpress}
 * @see {@link https://github.com/wp-cli/wp-cli}
 * @see {@link https://github.com/stuttter/ludicrousdb}
 * @see {@link https://github.com/humanmade/S3-Uploads}
 */
import type { IResource, ResourceEnvironment } from "aws-cdk-lib";
import {
  Annotations,
  aws_ec2 as ec2,
  aws_efs as efs,
  aws_lambda as lambda,
  aws_rds as rds,
  DockerImage,
  Duration,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { readFileSync } from "node:fs";

// cspell:words binlog, slowquery, bref, apcu

export class WordpressServerless extends Construct implements IResource {
  readonly stack: Stack;
  readonly env: ResourceEnvironment;

  constructor(scope: Construct, id: string, _props?: {}) {
    super(scope, id);
    this.stack = Stack.of(scope);
    this.env = { region: this.stack.region, account: this.stack.account };

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      natGateways: 0,
      maxAzs: 2, // defaults to all AZs of region
      flowLogs: {},
    });

    // Initialize MySQL as Aurora Serverless v2 cluster
    // Create an interface endpoint for secrets manager, so our Lambda function can securely query for the generated Database credentials.
    vpc.addInterfaceEndpoint("SecretsManager Endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    const engine = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_02_1,
    });
    const parameterGroup = new rds.ParameterGroup(
      this,
      "MySQL Parameter Group",
      {
        engine,
        parameters: {
          character_set_database: "utf8",
          general_log: "1",
          log_output: "TABLE",
          binlog_format: "ROW", // DMS replication
          binlog_row_image: "Full", // DMS replication
          binlog_checksum: "NONE", // DMS Replication
          server_audit_logging: "1",
          server_audit_events:
            "CONNECT,QUERY,QUERY_DCL,QUERY_DDL,QUERY_DML,TABLE",
          max_allowed_packet: "51200000",
        },
      },
    );
    const dbCluster = new rds.DatabaseCluster(this, "MySQL Cluster", {
      engine,
      iamAuthentication: true,
      instanceProps: {
        instanceType: new ec2.InstanceType("serverless"),
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        enablePerformanceInsights: true,
        publiclyAccessible: true,
      },
      parameterGroup,
      copyTagsToSnapshot: false,
      backup: { retention: Duration.days(14) },
      cloudwatchLogsExports: ["error", "slowquery", "general", "audit"],
      cloudwatchLogsRetention: RetentionDays.SIX_MONTHS,
    });

    const cfnCluster = dbCluster.node.defaultChild;
    if (cfnCluster instanceof rds.CfnDBCluster) {
      cfnCluster.serverlessV2ScalingConfiguration = {
        minCapacity: 0.5,
        maxCapacity: 2,
      };
    } else
      Annotations.of(dbCluster).addError(
        "Failed to add Serverless v2 configuration",
      );
    dbCluster.connections.allowDefaultPortInternally();
    dbCluster.connections.allowDefaultPortFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      "Allow explicit inbound traffic on default port from within VPC",
    );

    // Master user is acceptable to have the minimal downtime of single user rotation since it is
    // only used to manage other users and not for any application connections
    dbCluster.addRotationSingleUser({
      automaticallyAfter: Duration.days(31),
    });

    // Creating EFS
    const efsFilesystem = new efs.FileSystem(this, "Efs", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      encrypted: false,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const accessPoint = efsFilesystem.addAccessPoint("Efs AccessPoint", {
      createAcl: {
        ownerUid: "1000",
        ownerGid: "1000",
        permissions: "0777",
      },
      posixUser: {
        uid: "1000",
        gid: "1000",
      },
    });

    // creating lambda
    // We need to prep the wrapper that is used to enable PHP multi-page app functionality, as well as some of the value-add features.
    const ASSETS_DIR = "cdk-serverless-wordpress";
    const lambdaAssetCodeBuildCommands = [
      `export ASSETS_DIR=/asset-output/${ASSETS_DIR}`,
      "mkdir -p $ASSETS_DIR",
      `echo "${readFileSync(require.resolve("./php/wrapper.php")).toString(
        "base64",
      )}" | base64 -d > $ASSETS_DIR/wrapper.php`,
      "composer --no-cache --no-audit --no-progress --no-interaction --optimize-autoloader --apcu-autoloader require --working-dir $ASSETS_DIR bref/bref guzzlehttp/guzzle aws/aws-sdk-php",
      'if [ -d "/asset-input/public_html" ]; then cp -au /asset-input/* /asset-output/; else mkdir /asset-output/public_html && cp -au /asset-input/* /asset-output/public_html/; fi',
      'mkdir -p /asset-output/php/conf.d && echo "extension=apcu" > /asset-output/php/conf.d/apcu.ini',
      "echo Downloaded $(du -sh $ASSETS_DIR) during asset build",
    ];

    const handler = new lambda.Function(this, "Lambda", {
      runtime: lambda.Runtime.PROVIDED_AL2,
      memorySize: 1024,
      timeout: Duration.minutes(15) /* maxing out */,
      handler: "cdk-serverless-php-mpa-utils/wrapper.php",
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "BrefPhpFpmLayer",
          /** @see {@link https://bref.sh/docs/runtimes/} */
          "arn:aws:lambda:us-east-1:209497400698:layer:php-80-fpm:47",
        ),
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "GdPhpLayer",
          "arn:aws:lambda:us-east-1:403367587399:layer:gd-php-80:11",
        ),
      ],
      code: lambda.Code.fromAsset(__dirname, {
        bundling: {
          command: ["bash", "-c", lambdaAssetCodeBuildCommands.join(" && ")],
          image: DockerImage.fromRegistry(
            "public.ecr.aws/composer/composer:latest-bin",
          ),
        },
      }),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        BREF_BINARY_RESPONSES: "1", // Needed for returning binary content like image files - https://bref.sh/docs/runtimes/http.html#binary-requests-and-responses
        BREF_AUTOLOAD_PATH: `/var/task/${ASSETS_DIR}/vendor/autoload.php`,
        RDS_SECRET_INJECT: "",
        RDS_SECRET_ARN: dbCluster.secret!.secretArn,
        TMPDIR: "/mnt/persistent/tmp",
      },
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      filesystem: lambda.FileSystem.fromEfsAccessPoint(
        accessPoint,
        "/mnt/persistent",
      ),
    });

    // The wrapper that is used to enable PHP multi-page app functionality has features switched on via some of these environment variables.
    // propsWithDefaults.directoryIndexFile &&
    //   this.function.addEnvironment(
    //     "SERVERLESS_PHP_MPA_INDEX_FILE",
    //     propsWithDefaults.directoryIndexFile,
    //   );
    // propsWithDefaults.customErrorFile &&
    //   this.function.addEnvironment(
    //     "SERVERLESS_PHP_MPA_REWRITE_FILE",
    //     propsWithDefaults.customErrorFile,
    //   );
  }

  applyRemovalPolicy(_policy: RemovalPolicy): void {
    throw new Error("Method not implemented.");
  }
}
