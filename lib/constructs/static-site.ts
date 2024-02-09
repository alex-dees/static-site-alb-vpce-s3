import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbTgt from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

export interface SiteProps {
    vpc: ec2.IVpc,
    s3: {
        name: string,
        asset: string,
        vpce: ec2.InterfaceVpcEndpoint
    },
    lb: {
        path: string,
        priority: number,
        listener: elb.ApplicationListener
    }
}

export class StaticSite extends Construct {
    private epIps: string[];

    constructor(scope: Construct, id: string, private props: SiteProps) {
        super(scope, id);
        this.getEpIps();
        this.deployS3();
        this.updateLb();
    }

    // support existing bucket?
    private deployS3(){
        const bkt = new s3.Bucket(this, 'Bkt', {
            autoDeleteObjects: true,
            bucketName: this.props.s3.name,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        new deploy.BucketDeployment(this, 'Deploy', {
            destinationBucket: bkt,
            sources: [deploy.Source.asset(this.props.s3.asset)]
        });

        bkt.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            principals: [new iam.AnyPrincipal()],
            resources: [
                bkt.bucketArn,
                `${bkt.bucketArn}/*`
            ],
            conditions: {
              'StringEquals': {
                'aws:SourceVpce': this.props.s3.vpce.vpcEndpointId
              }
            }
        }));
    }

    private updateLb() {
        const lb = this.props.lb;
        this.props.lb.listener.addTargets('Targets', {
            port: 443,
            priority: lb.priority,
            targets: [
                new elbTgt.IpTarget(this.epIps[0]),
                new elbTgt.IpTarget(this.epIps[1])
            ],
            conditions: [
                elb.ListenerCondition.pathPatterns([lb.path])
            ],
            healthCheck: {
                path: '/',
                port: '443',
                protocol: elb.Protocol.HTTPS,
                healthyHttpCodes: '200,307,405',
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 5,
                timeout: cdk.Duration.seconds(30),
                interval: cdk.Duration.seconds(60)      
            }
        })
    }

    private getEpIps() {
        const ep = this.props.s3.vpce;
        const res = new cr.AwsCustomResource(this, 'Custom', {
            // also called for create
            onUpdate: { 
                service: 'EC2',
                action: 'describeNetworkInterfaces',
                parameters: { NetworkInterfaceIds: ep.vpcEndpointNetworkInterfaceIds },
                physicalResourceId: cr.PhysicalResourceId.of(`DecribeEni-${Date.now().toString()}`)
            },
            policy: {
                statements: [new iam.PolicyStatement({
                    actions: ['ec2:DescribeNetworkInterfaces'],
                    resources: ['*']
                })]
            }
        });
        this.epIps = [
            res.getResponseField('NetworkInterfaces.0.PrivateIpAddress'),
            res.getResponseField('NetworkInterfaces.1.PrivateIpAddress')
        ];
    }
}
