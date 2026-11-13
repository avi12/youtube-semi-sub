import { describe, expect, it } from "vitest";

import { defineValidatedMessaging } from "@/lib/messaging/validated-messaging";
import { z } from "@/lib/zod";

enum TestMessage {
  double = "double",
  ping = "ping"
}

const SCHEMAS = {
  [TestMessage.double]: {
    request: z.object({ value: z.number() }),
    reply: z.number()
  },
  [TestMessage.ping]: {
    request: z.undefined(),
    reply: z.literal("pong")
  }
};

/** Delivers each message straight to its one handler, without checking anything - like a real messenger */
function createLoopbackMessenger() {
  const handlers = new Map<string, (message: { data: unknown }) => unknown>();
  return {
    async sendMessage(type: TestMessage, data: unknown) {
      const handler = handlers.get(type);
      if (!handler) {
        throw new Error(`No handler for ${type}`);
      }

      return await handler({ data });
    },
    onMessage(type: TestMessage, onReceived: (message: { data: unknown }) => unknown) {
      handlers.set(type, onReceived);
      return () => handlers.delete(type);
    }
  };
}

describe("defineValidatedMessaging", () => {
  it("hands the handler the parsed payload and the sender the parsed reply", async () => {
    const messenger = createLoopbackMessenger();
    const { onMessage, sendMessage } = defineValidatedMessaging({
      schemas: SCHEMAS,
      messenger
    });
    onMessage(TestMessage.double, ({ value }) => value * 2);
    onMessage(TestMessage.ping, () => "pong");

    expect(await sendMessage(TestMessage.double, { value: 21 })).toBe(42);
    expect(await sendMessage(TestMessage.ping)).toBe("pong");
  });

  it("rejects a malformed payload before the handler sees it", async () => {
    const messenger = createLoopbackMessenger();
    const { onMessage } = defineValidatedMessaging({
      schemas: SCHEMAS,
      messenger
    });
    let isHandled = false;
    onMessage(TestMessage.double, ({ value }) => {
      isHandled = true;
      return value;
    });

    await expect(messenger.sendMessage(TestMessage.double, { value: "21" })).rejects.toThrow();
    expect(isHandled).toBe(false);
  });

  it("rejects a reply that doesn't fit its schema", async () => {
    const messenger = createLoopbackMessenger();
    const { sendMessage } = defineValidatedMessaging({
      schemas: SCHEMAS,
      messenger
    });
    messenger.onMessage(TestMessage.ping, () => "not pong");

    await expect(sendMessage(TestMessage.ping)).rejects.toThrow();
  });
});
