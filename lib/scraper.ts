import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodefn from 'aws-cdk-lib/aws-lambda-nodejs';

export class Scraper extends Construct {
  constructor(scope: Construct, id: string, private vpc: ec2.IVpc) {
    super(scope, id);

    const bkt = new s3.Bucket(this, 'Scrapes', {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // https://github.com/shelfio/chrome-aws-lambda-layer
    const layer = lambda.LayerVersion.fromLayerVersionArn(this, 'Layer', 
      'arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:42');
  
    const fn = new nodefn.NodejsFunction(this, 'Fn', {
      vpc: vpc,
      layers: [layer],
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda', 'index.ts'),
      bundling: {
        externalModules: [
          '@aws-sdk/*',
          '@sparticuz/chromium'
        ]
      },
      environment: {  
        BUCKET: bkt.bucketName
      }
    });
  
    fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['s3:*'],
        effect: iam.Effect.ALLOW,
        resources: ['*']
    }));    
  }
}