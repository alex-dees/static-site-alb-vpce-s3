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
        
        const image = `${Date.now()}.png`;
        const input = {
            Key: image,
            Body: buffer,
            ContentType: 'image/png',
            Bucket: process.env.BUCKET
        };
        const client = new S3Client();
        const command = new PutObjectCommand(input);
        const response = await client.send(command);

        return image;
    } catch (e) {
        console.error(e);
        throw e;
    }
}