import { timingSafeEqual } from "node:crypto";
import { getDarajaCallbackToken } from "@/lib/daraja";
import { createServiceClient } from "@/lib/supabase/service";

type CallbackItem = { Name?: string; Value?: string | number };
type DarajaCallback = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: string | number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: CallbackItem[] };
    };
  };
};

function safeTokenMatch(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

function normalizePhone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

export async function POST(request: Request) {
  const expectedToken = getDarajaCallbackToken();
  const suppliedToken = new URL(request.url).searchParams.get("token") ?? "";
  if (expectedToken.length < 32 || !safeTokenMatch(suppliedToken, expectedToken)) {
    return Response.json({ ResultCode: 1, ResultDesc: "Not found" }, { status: 404 });
  }

  let callback: DarajaCallback;
  try {
    callback = await request.json() as DarajaCallback;
  } catch {
    return Response.json({ ResultCode: 1, ResultDesc: "Invalid callback" }, { status: 400 });
  }
  const stk = callback.Body?.stkCallback;
  if (!stk?.CheckoutRequestID || !stk.MerchantRequestID || stk.ResultCode === undefined) {
    return Response.json({ ResultCode: 1, ResultDesc: "Incomplete callback" }, { status: 400 });
  }
  const metadata = new Map((stk.CallbackMetadata?.Item ?? []).map((item) => [item.Name ?? "", item.Value]));
  const rawAmount = metadata.get("Amount");
  const parsedAmount = rawAmount === undefined ? null : Number(rawAmount);
  const amount = parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null;
  const phone = normalizePhone(metadata.get("PhoneNumber"));
  const receipt = metadata.get("MpesaReceiptNumber");
  const resultCode = String(stk.ResultCode);

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("process_daraja_payment_callback", {
      target_checkout_id: stk.CheckoutRequestID,
      target_merchant_id: stk.MerchantRequestID,
      callback_result_code: resultCode,
      callback_result_description: stk.ResultDesc ?? "",
      callback_amount: amount,
      callback_phone: phone,
      callback_receipt: typeof receipt === "string" ? receipt : null,
    });
    if (error) return Response.json({ ResultCode: 1, ResultDesc: "Could not record callback" }, { status: 500 });
  } catch {
    return Response.json({ ResultCode: 1, ResultDesc: "Payment callback processing is unavailable" }, { status: 500 });
  }

  return Response.json({ ResultCode: 0, ResultDesc: "Callback received" });
}
