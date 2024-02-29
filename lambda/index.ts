import { Handler } from "aws-lambda";
import { QuickSightClient, GenerateEmbedUrlForAnonymousUserCommand } from "@aws-sdk/client-quicksight";

// TO-DO: pass these to function
const region = ''
const account = '';
const dashboard = '';
const dashboardArn = ``;

export const handler: Handler = async (event) => {
    try {
        const client = new QuickSightClient({ region });
        const input = {
            Namespace: 'default',
            AwsAccountId: account,
            SessionLifetimeInMinutes: 600,
            ExperienceConfiguration: {
                Dashboard: {
                    InitialDashboardId: dashboard
                }
            },    
            AuthorizedResourceArns: [ dashboardArn ]
        };
        const command = new GenerateEmbedUrlForAnonymousUserCommand(input);
        const response = await client.send(command);
        
        // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#respond-to-load-balancer
        return {
            statusCode: 200,
            isBase64Encoded: false,
            body: response.EmbedUrl,
            headers: { 'Content-Type': 'text/html;'}
        };
    } catch (e) {
        console.error(e);
        throw e;
    }
}