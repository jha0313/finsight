import { Polar } from "@polar-sh/sdk";
import { validateEvent } from "@polar-sh/sdk/webhooks";

type PolarServer = "sandbox" | "production";

type PolarCheckoutInput = {
  customerExternalId: string;
  productId?: string;
  successUrl?: string;
};

type PolarWebhookEvent = {
  eventId: string;
  type: string;
  data: unknown;
};

type SubscriptionUpsert = {
  userId: string;
  polarSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  eventTimestamp: string | null;
};

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.past_due",
]);

export function createPolarCheckout(): {
  create(input: PolarCheckoutInput): Promise<{ url: string }>;
} {
  return {
    async create(input) {
      const customerExternalId = requireNonEmpty(
        input.customerExternalId,
        "customerExternalId",
      );
      const productId =
        input.productId === undefined || input.productId === ""
          ? requireEnv("POLAR_PRODUCT_ID")
          : input.productId;
      const payload: {
        products: string[];
        externalCustomerId: string;
        successUrl?: string;
      } = {
        products: [productId],
        externalCustomerId: customerExternalId,
      };

      if (input.successUrl !== undefined && input.successUrl !== "") {
        payload.successUrl = input.successUrl;
      }

      const checkout = await createPolarClient().checkouts.create(payload);
      const url = getStringField(checkout, "url");

      if (url === null) {
        throw new Error("Polar checkout response did not include a url.");
      }

      return { url };
    },
  };
}

export function verifyPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
): PolarWebhookEvent {
  const webhookHeaders = normalizeWebhookHeaders(headers);
  const payload = validateEvent(
    rawBody,
    webhookHeaders,
    requireEnv("POLAR_WEBHOOK_SECRET"),
  );
  const eventRecord = asRecord(payload, "Polar webhook payload");
  const type = getRequiredStringField(eventRecord, "type", "webhook type");

  return {
    eventId: webhookHeaders["webhook-id"],
    type,
    data: eventRecord.data,
  };
}

export function toSubscriptionUpsert(event: {
  type: string;
  data: unknown;
}): SubscriptionUpsert | null {
  if (!SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
    return null;
  }

  const data = asRecord(event.data, "Polar subscription event data");

  return {
    userId: readCustomerExternalId(data),
    polarSubscriptionId: getRequiredStringField(
      data,
      "id",
      "polar subscription id",
    ),
    status: getRequiredStringField(data, "status", "subscription status"),
    currentPeriodEnd: normalizePeriodEnd(
      data.currentPeriodEnd ?? data.current_period_end,
    ),
    eventTimestamp: normalizeEventTimestamp(
      data.modifiedAt ??
        data.modified_at ??
        data.createdAt ??
        data.created_at,
    ),
  };
}

function createPolarClient(): Polar {
  return new Polar({
    accessToken: requireEnv("POLAR_ACCESS_TOKEN"),
    server: readPolarServer(),
  });
}

function readPolarServer(): PolarServer {
  const value = process.env.POLAR_SERVER;

  if (value === undefined || value === "") {
    return "production";
  }

  if (value !== "sandbox" && value !== "production") {
    throw new Error("POLAR_SERVER must be either sandbox or production.");
  }

  return value;
}

function normalizeWebhookHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return {
    "webhook-id": requireNonEmpty(
      getHeader(headers, "webhook-id"),
      "webhook-id",
    ),
    "webhook-timestamp": requireNonEmpty(
      getHeader(headers, "webhook-timestamp"),
      "webhook-timestamp",
    ),
    "webhook-signature": requireNonEmpty(
      getHeader(headers, "webhook-signature"),
      "webhook-signature",
    ),
  };
}

function getHeader(
  headers: Record<string, string>,
  expectedName: string,
): string | undefined {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === expectedName) {
      return value;
    }
  }

  return undefined;
}

function readCustomerExternalId(data: Record<string, unknown>): string {
  const directExternalId =
    data.customerExternalId ?? data.customer_external_id ?? data.externalCustomerId;
  const directValue =
    typeof directExternalId === "string" ? directExternalId : undefined;

  if (directValue !== undefined && directValue !== "") {
    return directValue;
  }

  const customer = asRecord(data.customer, "Polar subscription customer");
  const customerExternalId = customer.externalId ?? customer.external_id;

  if (typeof customerExternalId !== "string" || customerExternalId === "") {
    throw new Error(
      "Polar subscription event is missing customerExternalId.",
    );
  }

  return customerExternalId;
}

function normalizePeriodEnd(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value !== "") {
    return value;
  }

  throw new Error("Polar subscription currentPeriodEnd is invalid.");
}

function normalizeEventTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value !== "") {
    return value;
  }

  return null;
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function getStringField(value: unknown, field: string): string | null {
  const record = asRecord(value, "Polar checkout response");
  const fieldValue = record[field];

  return typeof fieldValue === "string" && fieldValue !== "" ? fieldValue : null;
}

function getRequiredStringField(
  record: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = record[field];

  if (typeof value !== "string" || value === "") {
    throw new Error(`Polar ${label} is missing.`);
  }

  return value;
}

function requireEnv(name: string): string {
  return requireNonEmpty(process.env[name], name);
}

function requireNonEmpty(value: string | undefined, label: string): string {
  if (value === undefined || value === "") {
    throw new Error(`${label} is required.`);
  }

  return value;
}
