import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodefn from 'aws-cdk-lib/aws-lambda-nodejs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbTgt from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

export interface EmbedProps {
  path: string,
  priority: number,
  listener: elb.ApplicationListener
}

export class Embedder extends Construct {
  constructor(scope: Construct, id: string, private props: EmbedProps) {
    super(scope, id);
  
    const fn = new nodefn.NodejsFunction(this, 'Fn', {
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda', 'index.ts'),
      bundling: {
        externalModules: [
          '@aws-sdk/*'
        ]
      },
      environment: {  
        // BUCKET: bkt.bucketName
      }
    });
  
    fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['quicksight:*'],
        effect: iam.Effect.ALLOW,
        resources: ['*']
    }));

    const tg = new elb.ApplicationTargetGroup(this, 'EmbedTgtGrp', {
      targets: [new elbTgt.LambdaTarget(fn)]
    });

    props.listener.addAction('Embed', {
      priority: props.priority,
      action: elb.ListenerAction.forward([tg]),
      conditions: [ elb.ListenerCondition.pathPatterns([props.path]) ]
    });
  }
}