import { isElement } from "@/lib/dom-guards";
import { parseJson } from "@/lib/utils/json";
import { z } from "@/lib/zod";

// A YouTube Polymer element only renders when the page realm (MAIN world) creates it - one cloned by an ISOLATED Svelte
// template upgrades but never stamps its template - and its `.data` only exists there too. So an ISOLATED template
// renders a host that names the element, its data and its attributes in attributes both worlds share
// (`polymerHostAttributes`), and the MAIN world creates the element inside it and keeps it in step. Events from the
// element bubble through the host, where the template handles them

const TAG_ATTRIBUTE = "data-yss-polymer-tag";
const DATA_ATTRIBUTE = "data-yss-polymer-data";
const ATTRIBUTES_ATTRIBUTE = "data-yss-polymer-attributes";
const HOST_SELECTOR = `[${TAG_ATTRIBUTE}]`;
const POLYMER_TAG_PATTERN = /^(?:yt|tp-yt)-[a-z-]+$/;

/** An attribute Polymer reads itself: true sets it bare, false leaves it off */
const polymerAttributesSchema = z.record(z.string(), z.union([z.boolean(), z.string()]));
type PolymerAttributes = z.infer<typeof polymerAttributesSchema>;

/** The host's attributes, for any template to spread: the element to create, its `.data` and its own attributes */
export function polymerHostAttributes({
  tag,
  data,
  attributes = {}
}: {
  tag: string;
  data?: unknown;
  attributes?: PolymerAttributes;
}) {
  return {
    [TAG_ATTRIBUTE]: tag,
    [DATA_ATTRIBUTE]: data === undefined ? undefined : JSON.stringify(data),
    [ATTRIBUTES_ATTRIBUTE]: JSON.stringify(attributes)
  };
}

/** The data each element was last given, so an unchanged host doesn't make it render again */
const appliedDataByElement = new WeakMap<Element, string>();

function readPolymerElement(elHost: Element) {
  const tag = elHost.getAttribute(TAG_ATTRIBUTE) ?? "";
  if (!POLYMER_TAG_PATTERN.test(tag)) {
    return null;
  }

  const elExisting = elHost.firstElementChild;
  if (elExisting?.localName === tag) {
    return elExisting;
  }

  // `append`, not `replaceChildren`: YouTube patches the insertion methods to start its components' lifecycle, and an
  // element inserted any other way never renders
  const elPolymer = document.createElement(tag);
  elExisting?.remove();
  elHost.append(elPolymer);
  return elPolymer;
}

function syncAttributes({ elPolymer, attributesJson }: { elPolymer: Element; attributesJson: string | null }) {
  const parsed = polymerAttributesSchema.safeParse(parseJson(attributesJson ?? ""));
  for (const [name, value] of Object.entries(parsed.success ? parsed.data : {})) {
    if (value === false) {
      elPolymer.removeAttribute(name);
      continue;
    }

    const text = value === true ? "" : value;
    if (elPolymer.getAttribute(name) !== text) {
      elPolymer.setAttribute(name, text);
    }
  }
}

function syncHost(elHost: Element) {
  const elPolymer = readPolymerElement(elHost);
  if (!elPolymer) {
    return;
  }

  syncAttributes({
    elPolymer,
    attributesJson: elHost.getAttribute(ATTRIBUTES_ATTRIBUTE)
  });
  const dataJson = elHost.getAttribute(DATA_ATTRIBUTE);
  const data = dataJson === null ? null : parseJson(dataJson);
  const isNewData = data !== null && appliedDataByElement.get(elPolymer) !== dataJson;
  if (isNewData) {
    appliedDataByElement.set(elPolymer, dataJson ?? "");
    Object.assign(elPolymer, { data });
  }
}

function syncWithin(node: Node) {
  if (!isElement(node)) {
    return;
  }

  if (node.matches(HOST_SELECTOR)) {
    syncHost(node);
  }

  for (const elHost of node.querySelectorAll(HOST_SELECTOR)) {
    syncHost(elHost);
  }
}

/** MAIN world, document_start: builds and updates every host's Polymer element, now and as hosts come and change */
export function installPolymerHosts() {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        syncWithin(record.target);
        continue;
      }

      for (const node of record.addedNodes) {
        syncWithin(node);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [TAG_ATTRIBUTE, DATA_ATTRIBUTE, ATTRIBUTES_ATTRIBUTE]
  });
  syncWithin(document.documentElement);
}
