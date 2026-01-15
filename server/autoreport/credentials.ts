import { google, Auth } from 'googleapis';

let googleAuthClient: Auth.GoogleAuth | null = null;

export function getGoogleAuth(): Auth.GoogleAuth {
  if (googleAuthClient) {
    return googleAuthClient;
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  let credentials: any;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
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
