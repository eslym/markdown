import { fromMarkdown, type Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";
import { frontmatter } from "micromark-extension-frontmatter";

import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";

import type {
	Definition,
	Element,
	FootnoteDefinition,
	Root,
	RootContent,
	RootContentMap,
} from "mdast";
import type { Position } from "unist";
import { Walker } from "./walker";
import {
	disallowedInAnchor,
	disallowedInHeading,
	disallowedInListItem,
	disallowedInParagraph,
	selfClosingTags,
	tokenizeHTML,
} from "./html";
import { setWhenUnset } from "./utils";
import { buildDisableExtensions } from "./disables";
import type { MD } from "./types";

export interface SyntaxOptions {
	yaml?: boolean;
	link?: boolean;
	image?: boolean;
	autolink?:
		| boolean
		| {
				email?: boolean;
				protocol?: boolean;
		  };
	heading?: boolean;
	list?: boolean;
	reference?: boolean;
	code?: boolean;
	thematicBreak?: boolean;
	blockquote?: boolean;
	html?: boolean;
	/**
	 * Setting this to false will fully disable GFM support including strikethrough
	 */
	gfm?:
		| boolean
		| {
				table?: boolean;
				taskList?: boolean;
				autolink?:
					| boolean
					| {
							email?: boolean;
							http?: boolean;
							www?: boolean;
					  };
				footnote?: boolean;
		  };
	math?: boolean;
}

export interface ParseOptions {
	syntax?: SyntaxOptions;
	warning?: {
		disallowedElement?: boolean;
	};
}

function prepareExtensions(syntax: SyntaxOptions = {}) {
	const options: FromMarkdownOptions = {
		extensions: [],
		mdastExtensions: [],
	};
	if (syntax.yaml !== false) {
		options.extensions!.push(frontmatter("yaml"));
		options.mdastExtensions!.push(frontmatterFromMarkdown("yaml"));
	}
	if (syntax.gfm !== false) {
		options.extensions!.push(gfm());
		options.mdastExtensions!.push(gfmFromMarkdown());
	}
	if (syntax.math !== false) {
		options.extensions!.push(math());
		options.mdastExtensions!.push(mathFromMarkdown());
	}
	options.mdastExtensions!.push(buildDisableExtensions(syntax));
	return options;
}

interface AllNodeMap extends RootContentMap {
	root: Root;
	[key: string]: Root | RootContent;
}

export function parseMarkdown(markdown: string, options: ParseOptions = {}) {
	const shouldWarnForDisallowedElement = options.warning?.disallowedElement !== false;
	const droppedStructuralTags = new Set(["html", "head", "body"]);
	const ast = fromMarkdown(markdown, prepareExtensions(options.syntax));
	let metaString: string | undefined;
	const definitions: Record<string, Definition> = {};
	const footnotes: Record<string, FootnoteDefinition> = {};
	const walker = new Walker<AllNodeMap>();
	walker.on("enter", "yaml", (node, ctx) => {
		// Extract YAML frontmatter as a string for later parsing
		if (metaString === undefined) {
			metaString = node.value;
		}
		ctx.remove();
	});
	walker.on("enter", (node) => {
		// Convert position to [start, end] tuple for easier handling
		if (node.position) {
			node.pos = positionToPos(node.position);
			delete node.position;
		}
	});
	walker.on("enter", (node, ctx) => {
		if (!("children" in node)) return;
		const stacks: Element[] = [
			{
				type: "element",
				tagName: null!,
				children: [],
			},
		];
		for (const child of node.children) {
			if (child.type === "html") {
				const offset = child.pos?.[0] ?? child.position?.start.offset ?? 0;
				tokens: for (const token of tokenizeHTML(child.value)) {
					token.pos[0] += offset;
					token.pos[1] += offset;
					switch (token.type) {
						case "text":
						case "comment":
							{
								last(stacks).children.push(token);
							}
							break;
						case "open":
							{
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
								const parents = [...ctx.parents, node, ...stacks.slice(1)];
								if (!withinTemplate(parents)) {
									if (withinParagraph(parents) && disallowedInParagraph(token.tagName)) {
										warnForDisallowedElement(
											shouldWarnForDisallowedElement,
											token.tagName,
											"paragraph",
											token.pos,
										);
										continue tokens;
									}
									if (withinHeading(parents) && disallowedInHeading(token.tagName)) {
										warnForDisallowedElement(
											shouldWarnForDisallowedElement,
											token.tagName,
											"heading",
											token.pos,
										);
										continue tokens;
									}
									if (withinListItem(parents) && disallowedInListItem(token.tagName)) {
										warnForDisallowedElement(
											shouldWarnForDisallowedElement,
											token.tagName,
											"list item",
											token.pos,
										);
										continue tokens;
									}
									if (withinAnchor(parents) && disallowedInAnchor(token.tagName)) {
										warnForDisallowedElement(
											shouldWarnForDisallowedElement,
											token.tagName,
											"anchor",
											token.pos,
										);
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
							}
							break;
						case "close":
							{
								if (droppedStructuralTags.has(token.tagName)) {
									continue tokens;
								}
								// Pop the stack until we find a matching start tag,
								// and close any unclosed tags along the way.
								// If there is no matching start tag, discard the end tag like a browser would.
								const match = stacks.findLastIndex((el) => el.tagName === token.tagName);
								if (match === -1) break;
								for (let i = stacks.length - 1; i >= match; i--) {
									const element = stacks.pop()!;
									if (i === match) {
										element.pos![1] = token.pos[1];
									} else {
										closeUnclosedTag(element);
									}
									last(stacks).children.push(element);
								}
							}
							break;
					}
				}
			} else {
				last(stacks).children.push(child);
			}
		}
		if (stacks.length > 1) {
			while (stacks.length > 1) {
				const element = stacks.pop()!;
				closeUnclosedTag(element);
				last(stacks).children.push(element);
			}
		}
		node.children = stacks[0]!.children;
	});
	walker.on("enter", "text", (node, ctx) => {
		// Merge adjacent text nodes to simplify the tree
		if (ctx.previousSibling?.type === "text") {
			ctx.previousSibling.value += node.value;
			ctx.previousSibling.pos![1] = node.pos![1];
			ctx.remove();
		}
	});
	walker.on("enter", "definition", (node, ctx) => {
		setWhenUnset(definitions, node.identifier, node);
		ctx.remove();
	});
	walker.on("enter", "footnoteDefinition", (node, ctx) => {
		setWhenUnset(footnotes, node.identifier, node);
		ctx.remove();
	});
	const newRoot = walker.execute(ast);
	return {
		type: "root",
		children: (newRoot as Root).children,
		pos: newRoot.pos,
		meta: metaString,
		definitions,
		footnotes,
	} as MD.Document;
}

function positionToPos(position: Position): [start: number, end: number] {
	return [position.start.offset!, position.end.offset!];
}

function last<T>(arr: T[]): T {
	return arr[arr.length - 1]!;
}

function closeUnclosedTag(element: Element) {
	if (element.children.length === 0) return;
	const lastChild = last(element.children);
	element.pos![1] = lastChild.pos![1];
}

function withinParagraph(parents: (Root | RootContent)[]): boolean {
	return parents.some(
		(node) =>
			node.type === "paragraph" || (node.type === "element" && node.tagName.toLowerCase() === "p"),
	);
}

function withinHeading(parents: (Root | RootContent)[]): boolean {
	return parents.some(
		(node) =>
			node.type === "heading" || (node.type === "element" && /^h[1-6]$/i.test(node.tagName)),
	);
}

function withinListItem(parents: (Root | RootContent)[]): boolean {
	return parents.some(
		(node) =>
			node.type === "listItem" || (node.type === "element" && node.tagName.toLowerCase() === "li"),
	);
}

function withinAnchor(parents: (Root | RootContent)[]): boolean {
	return parents.some((node) => node.type === "element" && node.tagName.toLowerCase() === "a");
}

function withinTemplate(parents: (Root | RootContent)[]): boolean {
	return parents.some(
		(node) => node.type === "element" && node.tagName.toLowerCase() === "template",
	);
}

function warnForDisallowedElement(
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
