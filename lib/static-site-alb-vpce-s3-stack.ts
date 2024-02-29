import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Net } from './setup/net';
import { Shared } from './setup/shared';
import { Embedder } from './embedder';
import { StaticSite } from './static-site';

export interface IContext {
  sub: string,
  zone: string,
  cert: string,
  ingress: string,
  dashboard: string
}

export class StaticSiteAlbVpceS3Stack extends cdk.Stack {
  private net: Net;
  private fqdn: string;
  private ctx: IContext;
  private shared: Shared;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // create prereqs
    this.Setup();

    // add embed lambda to lb
    new Embedder(this, 'Embedder', {
      path: '/embed',
      priority: 5,
      dashboard: this.ctx.dashboard,
      listener: this.shared.listener
    });

    // set url for embed api
    const api = `const api = 'https://${this.fqdn}/embed';`;
    fs.writeFileSync(path.join(__dirname, '../dist/site2', 'config.js'), api);

    // add static sites to lb
    new StaticSite(this, 'Site', {
      path: '/site*',
      asset: './dist',
      priority: 10,
      bucket: this.shared.bucket,
      listener: this.shared.listener,
      targetGroup: this.shared.targetGroup
    });
  }

  private Setup() {
    this.ctx = <IContext>this
      .node.tryGetContext('app');

    this.fqdn = `${this.ctx.sub}.${this.ctx.zone}`;

    // create platform resources
    this.net = new Net(this, 'Net', this.ctx.zone);
    
    // create shared app resources    
    this.shared = new Shared(this, 'Shared', {
      vpc: this.net.vpc,
      sub: this.ctx.sub,
      zone: this.net.zone,
      cert: this.ctx.cert,
      s3Ep: this.net.s3Ep,
      ingress: this.ctx.ingress
    });
  }
}