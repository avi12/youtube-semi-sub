/**
 * A function we declare with 2+ parameters must take one destructured object instead, so every argument is named at
 * the call site:
 *   function insert({ video, contents }: {...})            // OK
 *   function insert(video, contents)                        // error
 *
 * Exempt - the signature is dictated by someone else, or it is an event subscription:
 * - a function passed straight to a call (`.map((item, i) => ...)`, `addEventListener("x", (e) => ...)`)
 * - a method or function value of an object literal - its shape is the type it implements (WXT's
 *   `"build:publicAssets"(_, assets)`, Svelte's `css: (progress, remaining) => ...`)
 * - a function assigned over an existing API (`globalThis.fetch = function watchedFetch(input, init) {...}`)
 * - a Svelte action/transition/animation, recognised by its first parameter typed as a DOM element
 *   (`function slideTile(node: Element, { from, to }: {...})`)
 * - TypeScript signatures without a body (interfaces, overloads, `declare`)
 * - an event-subscription function whose first parameter is the event name and second the callback:
 *   `function onPageMessage(eventName, callback)`
 */

const EVENT_NAME_PARAMS = new Set(["eventName", "messageType"]);
const CALLBACK_PARAMS = new Set(["callback", "listener"]);

function paramName(param) {
  const target = param.type === "AssignmentPattern" ? param.left : param;
  return target.type === "Identifier" ? target.name : null;
}

function isEventSubscription(params) {
  return params.length === 2
    && EVENT_NAME_PARAMS.has(paramName(params[0]))
    && CALLBACK_PARAMS.has(paramName(params[1]));
}

const ELEMENT_TYPE_PATTERN = /^(?:Element|HTML\w*Element|SVG\w*Element)$/;

function isCallArgument(node) {
  const { parent } = node;
  return (parent.type === "CallExpression" || parent.type === "NewExpression") && parent.arguments.includes(node);
}

function isObjectLiteralMember(node) {
  return node.parent.type === "Property" && node.parent.value === node;
}

function isSvelteNodeDirective(params) {
  const typeName = params[0].typeAnnotation?.typeAnnotation?.typeName?.name ?? "";
  return ELEMENT_TYPE_PATTERN.test(typeName);
}

function isAssignedOverExistingApi(node) {
  return node.parent.type === "AssignmentExpression" && node.parent.right === node;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Functions with 2+ parameters take a single destructured object (event subscriptions excepted)"
    },
    messages: {
      singleObjectParam: "Take a single destructured object ({ a, b }: {...}) instead of {{count}} positional parameters"
        + " - or, for an event subscription, (eventName, callback)"
    },
    schema: []
  },
  create(context) {
    function check(node) {
      const isExempt = node.params.length < 2
        || !node.body
        || isCallArgument(node)
        || isObjectLiteralMember(node)
        || isAssignedOverExistingApi(node)
        || isSvelteNodeDirective(node.params)
        || isEventSubscription(node.params);
      if (isExempt) {
        return;
      }

      context.report({
        node,
        messageId: "singleObjectParam",
        data: {
          count: node.params.length
        }
      });
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check
    };
  }
};
