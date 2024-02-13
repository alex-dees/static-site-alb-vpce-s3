import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbTgt from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

export interface SharedProps {
    vpc: ec2.IVpc,
    cert: string,
    bucket: string
    s3Ep: ec2.InterfaceVpcEndpoint
}

export class Shared extends Construct {
    readonly bucket: s3.Bucket;
    readonly lb: elb.ApplicationLoadBalancer;
    readonly listener: elb.ApplicationListener;
    readonly targetGroup: elb.ApplicationTargetGroup;

    constructor(scope: Construct, id: string, private props: SharedProps) {
        super(scope, id);
        this.lb = this.createLb();
        this.bucket = this.createBucket();
        this.listener = this.createListener();
        this.targetGroup = this.createTgtGrp();
    }

    private createListener() {
        // self-signed cert, see /ssl
        const cert = elb
            .ListenerCertificate
            .fromArn(this.props.cert);

        return new elb.ApplicationListener(this, 'Listener', {            
            port: 443,
            open: false,
            certificates: [cert],
            loadBalancer: this.lb,
            defaultAction: elb.ListenerAction.fixedResponse(404)
        });
    }

    private createLb() {
        const vpc = this.props.vpc;    
        const sg = new ec2.SecurityGroup(this, 'LbSg', { vpc });
        sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTcp());
        return new elb.ApplicationLoadBalancer(this, 'Lb', {
          vpc,
          securityGroup: sg
        });
    }

    private createBucket() {
        const bkt = new s3.Bucket(this, 'Bkt', {
            autoDeleteObjects: true,
            bucketName: this.props.bucket,
            removalPolicy: cdk.RemovalPolicy.DESTROY
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
                'aws:SourceVpce': this.props.s3Ep.vpcEndpointId
              }
            }
        }));

        return bkt;
    }

    private createTgtGrp() {
        const ips = this.getEpIps();
        return new elb.ApplicationTargetGroup(this, 'TgtGrp', {
            vpc: this.props.vpc,
            port: 443,
            targets: [
                new elbTgt.IpTarget(ips[0]),
                new elbTgt.IpTarget(ips[1])
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
        });
    }

    private getEpIps() {
        const ep = this.props.s3Ep;
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
        return [
            res.getResponseField('NetworkInterfaces.0.PrivateIpAddress'),
            res.getResponseField('NetworkInterfaces.1.PrivateIpAddress')
        ];
    }
}