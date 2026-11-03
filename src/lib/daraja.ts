import "server-only";

type DarajaSettings = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passkey: string;
  callbackBaseUrl: string;
  callbackToken: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
};

type OAuthResponse = { access_token?: string; expires_in?: string | number; errorMessage?: string };
type StkResponse = {
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  errorMessage?: string;
};

let cachedToken: { value: string; expiresAt: number } | undefined;

export class DarajaRequestError extends Error {
  constructor(message: string, readonly outcomeUnknown: boolean) {
    super(message);
    this.name = "DarajaRequestError";
  }
}

function getSettings(): DarajaSettings {
  const environment = process.env.DARAJA_ENV ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("DARAJA_ENV must be sandbox or production.");
  }
  const required = {
    consumerKey: process.env.DARAJA_CONSUMER_KEY,
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
    shortCode: process.env.DARAJA_SHORTCODE,
    passkey: process.env.DARAJA_PASSKEY,
    callbackBaseUrl: process.env.DARAJA_CALLBACK_BASE_URL,
    callbackToken: process.env.DARAJA_CALLBACK_TOKEN,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Daraja is not configured. Missing: ${missing.join(", ")}.`);
  if (required.callbackToken!.length < 32) throw new Error("DARAJA_CALLBACK_TOKEN must contain at least 32 characters.");
  const callback = new URL(required.callbackBaseUrl!);
  if (callback.protocol !== "https:") throw new Error("DARAJA_CALLBACK_BASE_URL must use HTTPS.");
  const transactionType = process.env.DARAJA_TRANSACTION_TYPE ?? "CustomerPayBillOnline";
  if (transactionType !== "CustomerPayBillOnline" && transactionType !== "CustomerBuyGoodsOnline") {
    throw new Error("DARAJA_TRANSACTION_TYPE must be CustomerPayBillOnline or CustomerBuyGoodsOnline.");
  }
  return {
    baseUrl: environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: required.consumerKey!,
    consumerSecret: required.consumerSecret!,
    shortCode: required.shortCode!,
    passkey: required.passkey!,
    callbackBaseUrl: callback.toString(),
    callbackToken: required.callbackToken!,
    transactionType,
  };
}

function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
}

async function getAccessToken(settings: DarajaSettings) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const credentials = Buffer.from(`${settings.consumerKey}:${settings.consumerSecret}`).toString("base64");
  const response = await fetch(`${settings.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as OAuthResponse;
  if (!response.ok || !body.access_token) throw new Error(body.errorMessage ?? "Daraja authentication failed.");
  const expiresIn = Number(body.expires_in ?? 3600);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + Math.max(expiresIn, 60) * 1000 };
  return cachedToken.value;
}

export async function requestDarajaStkPush(input: { phone: string; amount: number; reference: string; description?: string }) {
  const settings = getSettings();
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${settings.shortCode}${settings.passkey}${timestamp}`).toString("base64");
  const callback = new URL(settings.callbackBaseUrl);
  callback.searchParams.set("token", settings.callbackToken);
  const token = await getAccessToken(settings);
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        BusinessShortCode: settings.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: settings.transactionType,
        Amount: input.amount,
        PartyA: input.phone,
        PartyB: settings.shortCode,
        PhoneNumber: input.phone,
        CallBackURL: callback.toString(),
        AccountReference: `AW${input.reference.replaceAll("-", "").slice(0, 8)}`,
        TransactionDesc: input.description ?? "AW payment",
      }),
    });
  } catch {
    throw new DarajaRequestError("Daraja did not confirm whether it accepted the request. Do not retry yet; support must reconcile it to prevent a duplicate charge.", true);
  }
  let body: StkResponse;
  try {
    body = await response.json() as StkResponse;
  } catch {
    throw new DarajaRequestError("Daraja returned an unreadable response. Do not retry yet; support must reconcile the payment request.", true);
  }
  if (response.status >= 500 || (response.ok && body.ResponseCode === "0" && (!body.CheckoutRequestID || !body.MerchantRequestID))) {
    throw new DarajaRequestError("Daraja may have accepted the request, but returned incomplete tracking details. Do not retry; support must reconcile it.", true);
  }
  if (!response.ok || body.ResponseCode !== "0" || !body.CheckoutRequestID || !body.MerchantRequestID) {
    throw new DarajaRequestError(body.errorMessage ?? body.ResponseDescription ?? "Daraja rejected the STK Push request.", false);
  }
  return {
    checkoutRequestId: body.CheckoutRequestID,
    merchantRequestId: body.MerchantRequestID,
    customerMessage: body.CustomerMessage ?? "Check your phone and approve the M-PESA payment prompt.",
  };
}

export function getDarajaCallbackToken() {
  return process.env.DARAJA_CALLBACK_TOKEN ?? "";
}
