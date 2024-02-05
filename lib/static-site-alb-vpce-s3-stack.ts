import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StaticSite } from './constructs/static-site';
import { Setup, SetupProps } from './constructs/setup';

interface IContext extends SetupProps {};

export class StaticSiteAlbVpceS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ctx = <IContext>this.node.tryGetContext('app');
    const setup = new Setup(this, 'Prereqs', ctx);
    new StaticSite(this, 'Site', {
      vpc: setup.vpc,
      lb: {
        path: '/site*',
        priority: 10,
        listener: setup.listener
      },
      s3: {
        asset: './dist',
        vpce: setup.s3Ep,
        name: `${ctx.sub}.${ctx.zone}`,
      }
    });
  }
}