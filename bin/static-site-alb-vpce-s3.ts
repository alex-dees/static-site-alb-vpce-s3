#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IContext, StaticSiteAlbVpceS3Stack } from '../lib/static-site-alb-vpce-s3-stack';

const app = new cdk.App();

new StaticSiteAlbVpceS3Stack(app, 'StaticSiteAlbVpceS3Stack', {
  context: <IContext>app.node.tryGetContext('app'),
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});