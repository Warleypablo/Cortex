import { google, Auth } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

let googleAuthClient: Auth.GoogleAuth | null = null;

export function getGoogleAuth(): Auth.GoogleAuth {
  if (googleAuthClient) {
    return googleAuthClient;
  }

  let serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  let credentials: any;
  try {
    serviceAccountJson = serviceAccountJson.trim();
    
    if (serviceAccountJson.endsWith('.json') || serviceAccountJson.startsWith('credentials/')) {
      const filePath = path.resolve(process.cwd(), serviceAccountJson);
      console.log(`[autoreport] Loading service account from file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Service account file not found: ${filePath}`);
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      credentials = JSON.parse(fileContent);
    } else {
      if (serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'")) {
        serviceAccountJson = serviceAccountJson.slice(1, -1);
      }
      if (serviceAccountJson.startsWith('"') && serviceAccountJson.endsWith('"')) {
        serviceAccountJson = serviceAccountJson.slice(1, -1);
      }
      
      // Temporarily protect the private_key content by extracting it
      const privateKeyMatch = serviceAccountJson.match(/"private_key"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      let preservedPrivateKey = '';
      
      if (privateKeyMatch) {
        preservedPrivateKey = privateKeyMatch[1];
        // Replace private_key with placeholder
        serviceAccountJson = serviceAccountJson.replace(
          /"private_key"\s*:\s*"(?:[^"\\]|\\.)*"/,
          '"private_key": "__PRESERVED_KEY__"'
        );
      }
      
      // Now safely normalize whitespace in the rest of the JSON
      serviceAccountJson = serviceAccountJson
        .replace(/\r\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ');
      
      credentials = JSON.parse(serviceAccountJson);
      
      // Restore the original private_key with proper newline handling
      if (preservedPrivateKey) {
        // Convert escaped \\n to actual newlines
        credentials.private_key = preservedPrivateKey.replace(/\\n/g, '\n');
      }
    }
    
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing required fields in service account JSON');
    }
    
    console.log(`[autoreport] Service account loaded: ${credentials.client_email}`);
  } catch (e: any) {
    console.error('[autoreport] Failed to parse service account JSON:', e.message);
    console.error('[autoreport] Input value starts with:', serviceAccountJson.substring(0, 50));
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON format: ${e.message}`);
  }

  googleAuthClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  });

  return googleAuthClient;
}

export function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

export function getSlidesClient() {
  const auth = getGoogleAuth();
  return google.slides({ version: 'v1', auth });
}

export function getAnalyticsDataClient() {
  const auth = getGoogleAuth();
  return google.analyticsdata({ version: 'v1beta', auth });
}

export interface GoogleAdsCredentials {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId: string;
}

export function getGoogleAdsCredentials(): GoogleAdsCredentials {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !loginCustomerId) {
    throw new Error('Google Ads credentials not fully configured');
  }

  return {
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    loginCustomerId,
  };
}

export interface MetaAdsCredentials {
  accessToken: string;
  businessId: string;
  appId: string;
}

export function getMetaAdsCredentials(): MetaAdsCredentials {
  const accessToken = process.env.ACCESS_TOKEN_META_SYSTEM;
  const businessId = process.env.BUSINESS_ID_META;
  const appId = process.env.APP_ID_META;

  if (!accessToken || !businessId) {
    throw new Error('Meta Ads credentials not fully configured');
  }

  return {
    accessToken,
    businessId,
    appId: appId || '',
  };
}
