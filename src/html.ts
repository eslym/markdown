import { setWhenUnset } from "./utils";
import { decode } from "he";
import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import type { Element, Parent, Root } from "mdast";

const tagStart = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/g;
const attrName = /^\s*([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const tagEnd = /^\s*(\/?)>/g;
const comment = /^<!--([\s\S]*?)-->/g;
const rawPreserveTags = new Set(["script", "style"]);
const decodedSpecialTags = new Set(["textarea"]);

export interface Token {
	pos: [start: number, end: number];
}

export interface TagOpen extends Token {
	type: "open";
	tagName: string;
	properties: Record<string, string>;
	/**
	 * Whether the tag is self-closing (e.g. `<br />`) or not (e.g. `<div>`). Note that this is determined syntactically, and does not necessarily reflect whether the tag is semantically self-closing according to HTML specifications. For example, `<div />` would be considered self-closing by this parser, even though `div` is not a self-closing tag in HTML.
	 */
	selfClosing: boolean;
}

export interface TagClose extends Token {
	type: "close";
	tagName: string;
}

export interface Comment extends Token {
	type: "comment";
	value: string;
}

export interface Text extends Token {
	type: "text";
	value: string;
}

export const selfClosingTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const disallowedParagraphTags = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"details",
	"dialog",
	"div",
	"dl",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hgroup",
	"hr",
	"main",
	"menu",
	"nav",
	"ol",
	"p",
	"pre",
	"search",
	"section",
	"table",
	"ul",
]);

const disallowedHeadingTags = new Set([
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"div",
	"p",
	"ul",
	"ol",
	"li",
	"table",
	"blockquote",
	"pre",
	"hr",
]);

const disallowedListItemTags = new Set(["li"]);

const disallowedAnchorTags = new Set(["a"]);
const droppedStructuralTags = new Set(["html", "head", "body"]);

function disallowedInParagraph(tagName: string): boolean {
	return disallowedParagraphTags.has(tagName.toLowerCase());
}

function disallowedInHeading(tagName: string): boolean {
	return disallowedHeadingTags.has(tagName.toLowerCase());
}

function disallowedInListItem(tagName: string): boolean {
	return disallowedListItemTags.has(tagName.toLowerCase());
}

function disallowedInAnchor(tagName: string): boolean {
	return disallowedAnchorTags.has(tagName.toLowerCase());
}

export function* tokenizeHTML(html: string): Generator<TagOpen | TagClose | Comment | Text> {
	let index = 0;
	const lowerHTML = html.toLowerCase();

	while (index < html.length) {
		if (html[index] !== "<") {
			const start = index;
			while (index < html.length && html[index] !== "<") {
				index += 1;
			}
			yield {
				type: "text",
				value: decode(html.slice(start, index)),
				pos: [start, index],
			};
			continue;
		}

		const commentMatch = comment.exec(html.slice(index));
		comment.lastIndex = 0;
		if (commentMatch) {
			const end = index + commentMatch[0].length;
			yield {
				type: "comment",
				value: commentMatch[1]!,
				pos: [index, end],
			};
			index = end;
			continue;
		}

		const tagMatch = tagStart.exec(html.slice(index));
		tagStart.lastIndex = 0;
		if (!tagMatch) {
			yield {
				type: "text",
				value: decode("<"),
				pos: [index, index + 1],
			};
			index += 1;
			continue;
		}

		const start = index;
		const closing = tagMatch[0][1] === "/";
		const tagName = tagMatch[1]!.toLowerCase();
		let cursor = index + tagMatch[0].length;

		if (closing) {
			const endTagMatch = tagEnd.exec(html.slice(cursor));
			tagEnd.lastIndex = 0;
			if (!endTagMatch) {
				yield {
					type: "text",
					value: decode("<"),
					pos: [index, index + 1],
				};
				index += 1;
				continue;
			}
			cursor += endTagMatch[0].length;
			yield {
				type: "close",
				tagName,
				pos: [start, cursor],
			};
			index = cursor;
			continue;
		}

		const properties: Record<string, string> = {};
		let parsed = false;

		while (cursor < html.length) {
			const endTagMatch = tagEnd.exec(html.slice(cursor));
			tagEnd.lastIndex = 0;
			if (endTagMatch) {
				cursor += endTagMatch[0].length;
				yield {
					type: "open",
					tagName,
					properties,
					selfClosing: endTagMatch[1] === "/",
					pos: [start, cursor],
				};
				index = cursor;
				parsed = true;
				break;
			}

			const attrMatch = attrName.exec(html.slice(cursor));
			attrName.lastIndex = 0;
			if (!attrMatch) {
				break;
			}

			cursor += attrMatch[0].length;
			const name = attrMatch[1]!.toLowerCase();
			const rawValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
			setWhenUnset(properties, name, decode(rawValue));
		}

		if (parsed) {
			if (rawPreserveTags.has(tagName) || decodedSpecialTags.has(tagName)) {
				const closeTag = findRawTextCloseTag(html, lowerHTML, cursor, tagName);
				if (closeTag === undefined) {
					if (cursor < html.length) {
						yield {
							type: "text",
							value: decodedSpecialTags.has(tagName)
								? decode(html.slice(cursor))
								: html.slice(cursor),
							pos: [cursor, html.length],
						};
					}
					index = html.length;
					continue;
				}

				if (cursor < closeTag.start) {
					yield {
						type: "text",
						value: decodedSpecialTags.has(tagName)
							? decode(html.slice(cursor, closeTag.start))
							: html.slice(cursor, closeTag.start),
						pos: [cursor, closeTag.start],
					};
				}

				yield {
					type: "close",
					tagName,
					pos: [closeTag.start, closeTag.end],
				};
				index = closeTag.end;
				continue;
			}

			continue;
		}

		yield {
			type: "text",
			value: decode("<"),
			pos: [index, index + 1],
		};
		index += 1;
	}
}

export interface HtmlFromMarkdownOptions {
	warnForDisallowedElement?: boolean;
}

export function htmlFromMarkdown(options: HtmlFromMarkdownOptions = {}): FromMarkdownExtension {
	const warnForDisallowedElement = options.warnForDisallowedElement !== false;

	return {
		transforms: [
			(tree) => {
				transformHTMLNodes(tree, [], warnForDisallowedElement);
				return tree;
			},
		],
	};
}

interface ContextNode {
	type: string;
	tagName?: string | null;
}

function transformHTMLNodes(
	node: Root | Parent,
	ancestors: ContextNode[],
	warnForDisallowedElement: boolean,
) {
	const stacks: Element[] = [
		{
			type: "element",
			tagName: "__root__",
			children: [],
		},
	];

	for (const child of node.children) {
		if (child.type === "html") {
			const offset = child.position?.start.offset ?? child.pos?.[0] ?? 0;
			consumeHtmlTokens(
				child.value,
				offset,
				[...ancestors, node as ContextNode],
				warnForDisallowedElement,
				stacks,
			);
			continue;
		}

		last(stacks).children.push(child);
	}

	flushUnclosed(stacks);
	node.children = stacks[0]!.children;

	for (const child of node.children) {
		if ("children" in child) {
			transformHTMLNodes(child, [...ancestors, node as ContextNode], warnForDisallowedElement);
		}
	}
}

function consumeHtmlTokens(
	raw: string,
	offset: number,
	ancestors: ContextNode[],
	warnForDisallowedElement: boolean,
	stacks: Element[],
) {
	tokens: for (const token of tokenizeHTML(raw)) {
		token.pos[0] += offset;
		token.pos[1] += offset;

		switch (token.type) {
			case "text":
				last(stacks).children.push({
					type: "text",
					value: token.value,
					pos: token.pos,
				});
				break;
			case "comment":
				last(stacks).children.push({
					type: "comment",
					value: token.value,
					pos: token.pos,
				});
				break;
			case "open": {
				if (droppedStructuralTags.has(token.tagName)) {
					continue tokens;
				}

				if (token.selfClosing || selfClosingTags.has(token.tagName)) {
					last(stacks).children.push({
						type: "element",
						tagName: token.tagName,
						properties: token.properties,
						children: [],
						pos: token.pos,
					});
					continue tokens;
				}

				const parents = [...ancestors, ...stacks.slice(1)];
				if (!withinTemplate(parents)) {
					if (withinParagraph(parents) && disallowedInParagraph(token.tagName)) {
						warnDisallowedElement(warnForDisallowedElement, token.tagName, "paragraph", token.pos);
						continue tokens;
					}
					if (withinHeading(parents) && disallowedInHeading(token.tagName)) {
						warnDisallowedElement(warnForDisallowedElement, token.tagName, "heading", token.pos);
						continue tokens;
					}
					if (withinListItem(parents) && disallowedInListItem(token.tagName)) {
						warnDisallowedElement(warnForDisallowedElement, token.tagName, "list item", token.pos);
						continue tokens;
					}
					if (withinAnchor(parents) && disallowedInAnchor(token.tagName)) {
						warnDisallowedElement(warnForDisallowedElement, token.tagName, "anchor", token.pos);
						continue tokens;
					}
				}

				stacks.push({
					type: "element",
					tagName: token.tagName,
					properties: token.properties,
					children: [],
					pos: token.pos,
				});
				break;
			}
			case "close": {
				if (droppedStructuralTags.has(token.tagName)) {
					continue tokens;
				}

				const match = stacks.findLastIndex((el) => el.tagName === token.tagName);
				if (match === -1) break;

				for (let i = stacks.length - 1; i >= match; i--) {
					const element = stacks.pop()!;
					if (i === match) {
						if (element.pos) {
							element.pos[1] = token.pos[1];
						}
					} else {
						closeUnclosedTag(element);
					}
					last(stacks).children.push(element);
				}
				break;
			}
		}
	}
}

function flushUnclosed(stacks: Element[]) {
	while (stacks.length > 1) {
		const element = stacks.pop()!;
		closeUnclosedTag(element);
		last(stacks).children.push(element);
	}
}

function last<T>(arr: T[]): T {
	return arr[arr.length - 1]!;
}

function closeUnclosedTag(element: Element) {
	if (element.children.length === 0 || !element.pos) return;
	const lastChild = element.children[element.children.length - 1];
	if (!lastChild?.pos) return;
	element.pos[1] = lastChild.pos[1];
}

function withinParagraph(parents: ContextNode[]): boolean {
	return parents.some(
		(node) =>
			node.type === "paragraph" || (node.type === "element" && node.tagName?.toLowerCase() === "p"),
	);
}

function withinHeading(parents: ContextNode[]): boolean {
	return parents.some(
		(node) =>
			node.type === "heading" || (node.type === "element" && /^h[1-6]$/i.test(node.tagName ?? "")),
	);
}

function withinListItem(parents: ContextNode[]): boolean {
	return parents.some(
		(node) =>
			node.type === "listItem" || (node.type === "element" && node.tagName?.toLowerCase() === "li"),
	);
}

function withinAnchor(parents: ContextNode[]): boolean {
	return parents.some((node) => node.type === "element" && node.tagName?.toLowerCase() === "a");
}

function withinTemplate(parents: ContextNode[]): boolean {
	return parents.some(
		(node) => node.type === "element" && node.tagName?.toLowerCase() === "template",
	);
}

function warnDisallowedElement(
	enabled: boolean,
	tagName: string,
	type: string,
	pos: [number, number],
) {
	if (!enabled) return;
	console.warn(
		`Warning: <${tagName}> is not allowed within a ${type}. Found at position ${pos[0]}-${pos[1]}. This tag will be ignored.`,
	);
}

function findRawTextCloseTag(
	html: string,
	lowerHTML: string,
	from: number,
	tagName: string,
): { start: number; end: number } | undefined {
	const needle = `</${tagName}`;
	let cursor = from;

	while (cursor < html.length) {
		const start = lowerHTML.indexOf(needle, cursor);
		if (start === -1) {
			return undefined;
		}

		const afterName = html[start + needle.length];
		if (afterName !== undefined && !/[\s>]/.test(afterName)) {
			cursor = start + needle.length;
			continue;
		}

		const close = /^\s*>/.exec(html.slice(start + needle.length));
		if (close) {
			return {
				start,
				end: start + needle.length + close[0].length,
			};
		}

		cursor = start + needle.length;
	}

	return undefined;
}
