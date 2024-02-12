import * as path from 'path';
import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { Net } from './constructs/net';
import { Shared } from './constructs/shared';
import { StaticSite } from './constructs/static-site';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodefn from 'aws-cdk-lib/aws-lambda-nodejs';

export interface IContext {
  sub: string,
  zone: string,
  cert: string
}

export interface StackContext extends cdk.StackProps {
  context: IContext
}

export class StaticSiteAlbVpceS3Stack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: StackContext) {
    super(scope, id, props);

    const ctx = props.context;

    // create platform resources
    const net = new Net(this, 'Net', ctx.zone);
    
    // create shared app resources
    // bucket name must match subdomain
    const name = `${ctx.sub}.${ctx.zone}`;
    const shared = new Shared(this, 'Shared', {
      vpc: net.vpc,
      s3Ep: net.s3Ep,
      bucket: name,
      cert: props.context.cert
    });
    
    new r53.CnameRecord(this, 'Cname', {
      zone: net.zone,
      recordName: ctx.sub,
      domainName: shared.lb.loadBalancerDnsName
    });

    // deploy site and add listener action
    new StaticSite(this, 'Site', {
      path: '/site*',
      asset: './dist',
      priority: 10,
      bucket: shared.bucket,
      listener: shared.listener,
      targetGroup: shared.targetGroup
    });

    // MOVE TO CONSTRUCT
    this.scrape(net.vpc);
  }

  private scrape(vpc: ec2.IVpc) {
    const bkt = new s3.Bucket(this, 'Scrapes', {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // https://github.com/shelfio/chrome-aws-lambda-layer
    // const layer = lambda.LayerVersion.fromLayerVersionArn(this, 'Layer', 
    //   'arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:42');

    const layer = new lambda.LayerVersion(this, "Layer", {
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      compatibleArchitectures: [lambda.Architecture.X86_64],
      code: lambda.Code.fromAsset("layers/chromium/chromium-v111.0.0-layer.zip"),
    });

    const fn = new nodefn.NodejsFunction(this, 'Fn', {
      vpc: vpc,
      layers: [layer],
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src', 'index.ts'),
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
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: ['*']
    }));
  }  
}