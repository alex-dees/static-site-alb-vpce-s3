import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as r53 from 'aws-cdk-lib/aws-route53';
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
    this.s3Ep = this.createEndpoints();
    this.listener = this.createLb();
    this.createBastion();
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

    // allow lb to access ep, health check is http
    this.s3Ep.connections.allowFrom(sg, ec2.Port.tcp(80));
    this.s3Ep.connections.allowFrom(sg, ec2.Port.tcp(443));
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

  private createEndpoints() {
    const sg = new ec2.SecurityGroup(this, 'VpceSg', { vpc: this.vpc });
    sg.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443));

    [
        ec2.InterfaceVpcEndpointAwsService.KMS,
        // for session manager
        ec2.InterfaceVpcEndpointAwsService.SSM,
        ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
    ].forEach(e => this.vpc.addInterfaceEndpoint(e.shortName, {
        service: e,
        securityGroups: [sg]
    }));

    return this.vpc.addInterfaceEndpoint('s3', {
        privateDnsEnabled: false,
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        securityGroups: [sg]
    });
  }

  private createBastion(){
    const host = new ec2.BastionHostLinux(this, 'Bastion', { 
        vpc: this.vpc,
        requireImdsv2: true,
        machineImage: ec2.MachineImage.latestAmazonLinux2()
    });

    host.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
  }
}