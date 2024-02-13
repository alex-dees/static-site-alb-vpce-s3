import { Handler } from "aws-lambda";
import chromium from "@sparticuz/chromium";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const handler: Handler = async (event) => {
    try {
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        }); 
        
        const page = await browser.newPage();
        await page.goto(<string>event.url);
        const buffer = await page.screenshot();

        const client = new S3Client();
        const input = {
          Body: buffer,
          Key: `${Date.now()}.png`,
          ContentType: 'image/png',
          Bucket: process.env.BUCKET
        };
        const command = new PutObjectCommand(input);
        const response = await client.send(command);
    } catch (e) {
        console.error(e);
        throw e;
    }
}