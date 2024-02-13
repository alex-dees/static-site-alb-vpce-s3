import { Net } from './setup/net';
import { Shared } from './setup/shared';
import { Scraper } from './scraper';
import { StaticSite } from './static-site';

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as r53 from 'aws-cdk-lib/aws-route53';

export interface IContext {
  sub: string,
  zone: string,
  cert: string
}

export class StaticSiteAlbVpceS3Stack extends cdk.Stack {
  private net: Net;
  private shared: Shared;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // create prereqs
    this.Setup();

    // deploy site and add rule
    new StaticSite(this, 'Site', {
      path: '/site*',
      asset: './dist',
      priority: 10,
      bucket: this.shared.bucket,
      listener: this.shared.listener,
      targetGroup: this.shared.targetGroup
    });

    // get screenshots of website
    new Scraper(this, 'Scraper', this.net.vpc);
  }

  private Setup() {
    const ctx = <IContext>this
      .node.tryGetContext('app');
    
    // create platform resources
    this.net = new Net(this, 'Net', ctx.zone);

    // create shared app resources
    // bucket name must match subdomain
    this.shared = new Shared(this, 'Shared', {
      cert: ctx.cert,
      vpc: this.net.vpc,
      s3Ep: this.net.s3Ep,
      bucket: `${ctx.sub}.${ctx.zone}`
    });

    new r53.CnameRecord(this, 'Cname', {
      zone: this.net.zone,
      recordName: ctx.sub,
      domainName: this.shared.lb.loadBalancerDnsName
    });
  }
}