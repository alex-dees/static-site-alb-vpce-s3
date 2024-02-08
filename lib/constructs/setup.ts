import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodefn from 'aws-cdk-lib/aws-lambda-nodejs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface SetupProps {
    sub: string,
    zone: string,
    cert: string
}

export class Setup extends Construct {

    readonly vpc: ec2.IVpc;
    readonly zone: r53.PrivateHostedZone;
    readonly listener: elb.ApplicationListener;
    readonly s3Ep: ec2.InterfaceVpcEndpoint;
    readonly s3Ips: string[];

  constructor(scope: Construct, id: string, private props: SetupProps) {
    super(scope, id);
    this.vpc = this.createVpc();
    this.zone = this.createZone();
    this.s3Ep = this.createEndpoint();
    this.listener = this.createLb();
    this.createLambda();
  }

  private createZone() {
    return new r53.PrivateHostedZone(this, 'Zone', {
        vpc: this.vpc,
        zoneName: this.props.zone
    });
  }

  private createVpc(){
    return new ec2.Vpc(this, 'Vpc', {
        maxAzs: 2,
        ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/25'),
        subnetConfiguration: [
            {
                name: 'isolated',
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED
            }
        ],
        gatewayEndpoints: {
            s3Gw: { service: ec2.GatewayVpcEndpointAwsService.S3 }
        }
    });
  }

  private createLb() {
    const vpc = this.vpc;    
    const sg = new ec2.SecurityGroup(this, 'LbSg', { vpc });
    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTcp());

    const lb = new elb.ApplicationLoadBalancer(this, 'Lb', {
      vpc,
      securityGroup: sg
    });

    new r53.CnameRecord(this, 'Cname', {
      zone: this.zone,
      recordName: this.props.sub,
      domainName: lb.loadBalancerDnsName
    });

    // uses self-signed cert, see /ssl
    const listener = lb.addListener('Listener', {
      port: 443,
      sslPolicy: elb.SslPolicy.TLS12,
      certificates: [{ 
        certificateArn: this.props.cert
      }]
    });

    listener.addAction('Default', {
      action: elb.ListenerAction.fixedResponse(404)
    });

    return listener;
  }

  private createEndpoint() {
    // target group health check is HTTP
    const sg = new ec2.SecurityGroup(this, 'S3EpSg', { vpc: this.vpc });
    sg.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(80));
    sg.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443));

    return this.vpc.addInterfaceEndpoint('s3', {
        privateDnsEnabled: false,
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        securityGroups: [sg]
    });
  }

  private createLambda() {
    const bkt = new s3.Bucket(this, 'Scrape', {
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
      vpc: this.vpc,
      layers: [layer],
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src', 'index.ts'),
      bundling: {
        externalModules: [
          '@aws-sdk/*',
          '@sparticuz/chromium'
        ]
      },
      environment: {  
        BUCKET: bkt.bucketName,
        URL: 'https://poc.sparxlabs.com/site/index.html',
      }
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: ['*']
    }));
  }
}