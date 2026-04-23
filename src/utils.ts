import type { RootContentMap } from "mdast";
import type { MD } from "./types";

export function setWhenUnset(
	obj: Record<PropertyKey, unknown>,
	key: PropertyKey,
	value: unknown,
): void {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		Object.defineProperty(obj, key, {
			value,
			enumerable: true,
			configurable: true,
			writable: true,
		});
	}
}

export function collectText(input: MD.Document | MD.Nodes | MD.Nodes[]): string {
	if (Array.isArray(input)) {
		return collectNodeText({ type: "root", children: input });
	}
	return collectNodeText(input);
}

function collectNodeText(node: MD.Document | MD.Nodes): string {
	if (node.type === "comment") {
		return "";
	}

	if ("value" in node && typeof node.value === "string") {
		return node.value;
	}

	if (node.type === "image") {
		return node.alt ?? "";
	}

	if (node.type === "thematicBreak" || node.type === "break") {
		return "\n";
	}

	if (node.type === "element") {
		const tagName = node.tagName.toLowerCase();
		if (tagName === "svg") {
			return "";
		}
		if (tagName === "img") {
			const alt = node.properties?.alt;
			if (typeof alt === "string") {
				return alt;
			}
		}
		if (tagName === "br" || tagName === "hr") {
			return "\n";
		}
	}

	if (!("children" in node)) {
		return "";
	}

	let text = "";
	let previousIsBlock = false;

	for (const child of node.children) {
		const childText = collectNodeText(child);
		if (childText === "") {
			continue;
		}
		if (isBlock(child)) {
			if (text !== "" && !text.endsWith("\n")) {
				text += "\n";
			}
			text += childText;
			previousIsBlock = true;
		} else if (previousIsBlock) {
			if (!text.endsWith("\n")) {
				text += "\n";
			}
			text += childText;
			previousIsBlock = false;
		} else {
			text += childText;
		}
	}

	return text;
}

const blockTypes = new Set<string>([
	"paragraph",
	"heading",
	"list",
	"listItem",
	"blockquote",
	"code",
	"thematicBreak",
	"table",
	"tableRow",
	"tableCell",
	"containerDirective",
	"leafDirective",
	"math",
] satisfies (keyof RootContentMap)[]);

const blockElementTags = new Set([
	"address",
	"article",
	"aside",
	"details",
	"dialog",
	"div",
	"dl",
	"dt",
	"dd",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"hgroup",
	"header",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"main",
	"menu",
	"nav",
	"p",
	"ul",
	"ol",
	"li",
	"search",
	"section",
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"th",
	"td",
	"blockquote",
	"pre",
]);

function isBlock(node: MD.Document | MD.Nodes): boolean {
	if (blockTypes.has(node.type)) {
		return true;
	}
	if (node.type === "element") {
		return blockElementTags.has(node.tagName.toLowerCase());
	}
	return false;
}
