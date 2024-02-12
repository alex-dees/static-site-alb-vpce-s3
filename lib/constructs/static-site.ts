import { Construct } from "constructs";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface SiteProps {
    path: string,
    asset: string,
    priority: number,
    bucket: s3.Bucket,
    listener: elb.ApplicationListener,
    targetGroup: elb.ApplicationTargetGroup
}

export class StaticSite extends Construct {
    constructor(scope: Construct, id: string, private props: SiteProps) {
        super(scope, id);

        new deploy.BucketDeployment(this, 'Deploy', {
            destinationBucket: props.bucket,
            sources: [deploy.Source.asset(props.asset)]
        });

        props.listener.addAction(`Site-${props.priority}`, {
            priority: props.priority,
            action: elb.ListenerAction.forward([props.targetGroup]),
            conditions: [ elb.ListenerCondition.pathPatterns([props.path]) ]
        });
    }
}
