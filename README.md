# Static Site with ALB, S3, and PrivateLink

This example demonstrates deploying a static site to S3, with end-to-end TLS, using an internal ALB and S3 interface endpoint.

[Reference](https://aws.amazon.com/blogs/networking-and-content-delivery/hosting-internal-https-static-websites-with-alb-s3-and-privatelink/)

## Install

Follow [instructions](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) to install CDK and bootstrap your account.


## Deploy
In cdk.json, choose a name for the private hosted zone and subdomain.  A bucket with the same name will be created, so it must be unique.

```
    "app": {
      "sub": "poc",
      "zone": "sparxlabs.com",
      "cert": ""
    }
```

Run the SSL script to create a self-signed certificate and import it into ACM.  This will also set the cert ARN in cdk.json that will be used to offload TLS on the ALB.
```
cd ssl
./ssl.sh <subdomain>
```

Deploy the CDK stack
```
cd ..
cdk deploy
```

## Test

The stack includes a VPC enabled lambda that can take screenshots of the internal websites.

<ol>
  <li>Open the Lambda console</li>
  <li>Select the scraper function</li>
  <li>Go to the Test tab and set the event url

```
"url": "https://poc.sparxlabs.com/site1/index.html"
```
  </li>
  <li>Open the S3 console</li>
  <li>Select the static site bucket</li>
  <li>Open the screenshots to verify the websites are displaying correctly</li>
</ol>