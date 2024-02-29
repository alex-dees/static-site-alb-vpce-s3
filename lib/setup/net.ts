import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as r53 from 'aws-cdk-lib/aws-route53';

export class Net extends Construct {

    readonly vpc: ec2.IVpc;
    readonly zone: r53.IHostedZone;
    readonly s3Ep: ec2.InterfaceVpcEndpoint;

  constructor(scope: Construct, id: string, private zoneName: string) {
    super(scope, id);
    this.vpc = this.createVpc();
    this.zone = this.createZone();
    this.s3Ep = this.createEndpoint();
  }

  private createZone() {
    return r53.HostedZone.fromLookup(this, 'Zone', {
      domainName: this.zoneName
    });
  }

  private createVpc(){
    return new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/25')
    });
  }

  private createEndpoint() {
    const sg = new ec2.SecurityGroup(this, 'EpSg', { vpc: this.vpc });
    sg.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443));
    
    return this.vpc.addInterfaceEndpoint('s3', {
      securityGroups: [sg],  
      privateDnsEnabled: false,
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
    });
  }
}