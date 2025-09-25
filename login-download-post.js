import { chromium } from '@playwright/test';
import fetch from 'node-fetch';

async function runForFarm({ email, password, farm, webUrl, token }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://danonemilkportal.com/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.click('text=Login')]);

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const resp = await page.request.get('https://danonemilkportal.com/vendors/receipt/export?format=xlsx', {
    headers: { Cookie: cookieHeader, Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*' }
  });
  if (!resp.ok()) throw new Error(`Export failed ${resp.status()}: ${await resp.text()}`);
  const buffer = Buffer.from(await resp.body());

  const base64 = buffer.toString('base64');
  const r = await fetch(webUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, farm, base64 })
  });
  console.log(farm, 'ingest ->', await r.text());
  await browser.close();
}

(async () => {
  const webUrl = process.env.WEBAPP_URL;
  const token = process.env.INGEST_TOKEN;

  await runForFarm({ email: process.env.MEARNS_EMAIL, password: process.env.MEARNS_PASSWORD, farm: 'MEARNS', webUrl, token });
  await runForFarm({ email: process.env.FAREND_EMAIL, password: process.env.FAREND_PASSWORD, farm: 'FAR END', webUrl, token });
})().catch(e => { console.error('Run failed:', e); process.exit(1); });
