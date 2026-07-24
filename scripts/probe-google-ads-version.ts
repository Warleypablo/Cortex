/**
 * Descobre quais versões da Google Ads API ainda respondem com as credenciais atuais.
 * Versão do Google tem sunset (~1 ano) — quando morre, tudo vira 404 sem aviso.
 * Uso: npx tsx scripts/probe-google-ads-version.ts
 */
import 'dotenv/config';
import { google } from 'googleapis';

async function main() {
  const o = new google.auth.OAuth2(process.env.GOOGLE_ADS_CLIENT_ID, process.env.GOOGLE_ADS_CLIENT_SECRET);
  o.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { credentials } = await o.refreshAccessToken();
  const tok = credentials.access_token;
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!;
  const cust = process.argv[2] || '5156174278';

  for (const v of ['v17','v18','v19','v20','v21','v22','v23','v24']) {
    try {
      const r = await fetch(`https://googleads.googleapis.com/${v}/customers/${cust}/googleAds:search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'developer-token': dev, 'login-customer-id': login, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT campaign.id FROM campaign LIMIT 1' }),
      });
      const t = await r.text();
      console.log(`${v}: ${r.status} — ${t.slice(0, 200).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`${v}: erro de rede — ${e.message}`);
    }
  }
}
main();
