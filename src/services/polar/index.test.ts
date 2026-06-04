import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPolarCheckout,
  toSubscriptionUpsert,
  verifyPolarWebhook,
} from "./index";

const polarMocks = vi.hoisted(() => {
  const checkoutsCreate = vi.fn();
  const validateEvent = vi.fn();
  const Polar = vi.fn(function Polar() {
    return {
      checkouts: {
        create: checkoutsCreate,
      },
    };
  });

  return {
    Polar,
    checkoutsCreate,
    validateEvent,
  };
});

vi.mock("@polar-sh/sdk", () => ({
  Polar: polarMocks.Polar,
}));

vi.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: polarMocks.validateEvent,
}));

const WEBHOOK_HEADERS = {
  "webhook-id": "evt_123",
  "webhook-signature": "v1,test-signature",
  "webhook-timestamp": "1760000000",
};

function setPolarEnv() {
  process.env.POLAR_ACCESS_TOKEN = "polar-token";
  process.env.POLAR_PRODUCT_ID = "product-default";
  process.env.POLAR_SERVER = "sandbox";
  process.env.POLAR_WEBHOOK_SECRET = "webhook-secret";
}

function clearPolarEnv() {
  delete process.env.POLAR_ACCESS_TOKEN;
  delete process.env.POLAR_PRODUCT_ID;
  delete process.env.POLAR_SERVER;
  delete process.env.POLAR_WEBHOOK_SECRET;
}

function subscriptionData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "sub_123",
    status: "active",
    currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
    customer: {
      externalId: "user_123",
    },
    ...overrides,
  };
}

describe("createPolarCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPolarEnv();
    setPolarEnv();
    polarMocks.checkoutsCreate.mockResolvedValue({
      url: "https://checkout.polar.sh/session",
    });
  });

  it("does not create the Polar client or read env until create is called", () => {
    clearPolarEnv();

    createPolarCheckout();

    expect(polarMocks.Polar).not.toHaveBeenCalled();
  });

  it("creates a checkout with the server-provided customerExternalId", async () => {
    const checkout = createPolarCheckout();

    const result = await checkout.create({
      customerExternalId: "auth-user-1",
      successUrl: "https://app.finsight.test/billing/success",
    });

    expect(polarMocks.Polar).toHaveBeenCalledWith({
      accessToken: "polar-token",
      server: "sandbox",
    });
    expect(polarMocks.checkoutsCreate).toHaveBeenCalledWith({
      products: ["product-default"],
      externalCustomerId: "auth-user-1",
      successUrl: "https://app.finsight.test/billing/success",
    });
    expect(result).toEqual({ url: "https://checkout.polar.sh/session" });
  });

  it("uses an explicit productId over POLAR_PRODUCT_ID", async () => {
    await createPolarCheckout().create({
      customerExternalId: "auth-user-2",
      productId: "product-override",
    });

    expect(polarMocks.checkoutsCreate).toHaveBeenCalledWith({
      products: ["product-override"],
      externalCustomerId: "auth-user-2",
    });
  });

  it("throws at call time when required Polar env is missing", async () => {
    clearPolarEnv();

    await expect(
      createPolarCheckout().create({
        customerExternalId: "auth-user-1",
        productId: "product-1",
      }),
    ).rejects.toThrow("POLAR_ACCESS_TOKEN");
  });
});

describe("verifyPolarWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPolarEnv();
    setPolarEnv();
  });

  it("verifies the raw body and returns the signed event id", () => {
    const rawBody = '{ "type": "subscription.active",\n "data": {"id":"sub_1"} }';
    polarMocks.validateEvent.mockReturnValue({
      type: "subscription.active",
      data: subscriptionData({ id: "sub_1" }),
    });

    const event = verifyPolarWebhook(rawBody, WEBHOOK_HEADERS);

    expect(polarMocks.validateEvent).toHaveBeenCalledWith(
      rawBody,
      WEBHOOK_HEADERS,
      "webhook-secret",
    );
    expect(event).toEqual({
      eventId: "evt_123",
      type: "subscription.active",
      data: subscriptionData({ id: "sub_1" }),
    });
  });

  it("throws when the raw body signature verification fails", () => {
    polarMocks.validateEvent.mockImplementation(() => {
      throw new Error("signature mismatch");
    });

    expect(() => verifyPolarWebhook("{}", WEBHOOK_HEADERS)).toThrow(
      "signature mismatch",
    );
  });
});

describe("toSubscriptionUpsert", () => {
  it("normalizes active subscription events for subscriptions upsert", () => {
    const upsert = toSubscriptionUpsert({
      type: "subscription.active",
      data: subscriptionData(),
    });

    expect(upsert).toEqual({
      userId: "user_123",
      polarSubscriptionId: "sub_123",
      status: "active",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    });
  });

  it("normalizes updated, canceled, and revoked subscription statuses", () => {
    expect(
      toSubscriptionUpsert({
        type: "subscription.updated",
        data: subscriptionData({
          status: "canceled",
          currentPeriodEnd: "2026-06-30T00:00:00.000Z",
        }),
      }),
    ).toMatchObject({
      userId: "user_123",
      polarSubscriptionId: "sub_123",
      status: "canceled",
      currentPeriodEnd: "2026-06-30T00:00:00.000Z",
    });

    expect(
      toSubscriptionUpsert({
        type: "subscription.revoked",
        data: subscriptionData({
          status: "revoked",
          currentPeriodEnd: null,
        }),
      }),
    ).toMatchObject({
      status: "revoked",
      currentPeriodEnd: null,
    });
  });

  it("returns null for non-subscription events", () => {
    expect(
      toSubscriptionUpsert({
        type: "checkout.created",
        data: { id: "checkout_123" },
      }),
    ).toBeNull();
  });

  it("throws when a subscription event has no customer external id", () => {
    expect(() =>
      toSubscriptionUpsert({
        type: "subscription.active",
        data: subscriptionData({
          customer: {
            externalId: null,
          },
        }),
      }),
    ).toThrow("customerExternalId");
  });
});
