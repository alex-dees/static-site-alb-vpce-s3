import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as r53 from 'aws-cdk-lib/aws-route53';

export class Net extends Construct {

    readonly vpc: ec2.IVpc;
    readonly zone: r53.PrivateHostedZone;
    readonly s3Ep: ec2.InterfaceVpcEndpoint;

  constructor(scope: Construct, id: string, private zoneName: string) {
    super(scope, id);
    this.vpc = this.createVpc();
    this.zone = this.createZone();
    this.s3Ep = this.createEndpoint();
  }

  private createZone() {
    return new r53.PrivateHostedZone(this, 'Zone', {
        vpc: this.vpc,
        zoneName: this.zoneName
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

  private createEndpoint() {
    const sg = new ec2.SecurityGroup(this, 'EpSg', { vpc: this.vpc });
    sg.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443));

    return this.vpc.addInterfaceEndpoint('s3', {
        privateDnsEnabled: false,
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        securityGroups: [sg]
    });
  }
}