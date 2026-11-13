import type { MaybePromise } from "@webext-core/messaging";

import type { z } from "@/lib/zod";

/** A messenger whose payloads are not trusted yet: `@webext-core/messaging`'s, before the schemas validate them */
interface UncheckedMessenger<TMessageType extends string> {
  sendMessage(type: TMessageType, data: unknown): Promise<unknown>;
  onMessage(type: TMessageType, onReceived: (message: { data: unknown }) => unknown): () => void;
}

/** Each message's payload and reply schema, keyed by message type */
type MessageSchemas<TSchemas> = {
  [TType in keyof TSchemas]: {
    request: z.ZodType;
    reply: z.ZodType;
  };
};

/** A message without a payload is sent without one */
type RequestArgs<TRequest> = undefined extends TRequest ? [data?: TRequest] : [data: TRequest];

/** Parses through a generic schema, so the result keeps that schema's own output type */
function parseWith<TSchema extends z.ZodType>({ schema, value }: { schema: TSchema; value: unknown }) {
  return schema.parse(value);
}

/**
 * Wraps a messenger so each message's zod schemas are the one source of its types and its checks: the handler gets
 * the payload parsed (a malformed one rejects the sender), and the sender gets the reply parsed
 */
export function defineValidatedMessaging<TSchemas extends MessageSchemas<TSchemas>>({
  schemas,
  messenger
}: {
  schemas: TSchemas;
  messenger: UncheckedMessenger<Extract<keyof TSchemas, string>>;
}) {
  return {
    async sendMessage<TType extends Extract<keyof TSchemas, string>>(
      type: TType,
      ...[data]: RequestArgs<z.input<TSchemas[TType]["request"]>>
    ) {
      const reply = await messenger.sendMessage(type, data);
      return parseWith<TSchemas[TType]["reply"]>({
        schema: schemas[type].reply,
        value: reply
      });
    },
    onMessage<TType extends Extract<keyof TSchemas, string>>(
      type: TType,
      onReceived: (data: z.output<TSchemas[TType]["request"]>) => MaybePromise<z.input<TSchemas[TType]["reply"]>>
    ) {
      return messenger.onMessage(type, ({ data }) =>
        onReceived(
          parseWith<TSchemas[TType]["request"]>({
            schema: schemas[type].request,
            value: data
          })
        )
      );
    }
  };
}
