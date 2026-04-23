import { fromMarkdown, type Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";
import { frontmatter } from "micromark-extension-frontmatter";
import { directive } from "micromark-extension-directive";

import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { directiveFromMarkdown } from "mdast-util-directive";

import type { Root, RootContent, RootContentMap } from "mdast";
import type { Position } from "unist";
import { Walker } from "./walker";
import { htmlFromMarkdown } from "./html";
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
	directive?: boolean;
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

function prepareExtensions(options: ParseOptions = {}) {
	const syntax = options.syntax ?? {};
	const extensionOptions: FromMarkdownOptions = {
		extensions: [],
		mdastExtensions: [],
	};
	if (syntax.yaml !== false) {
		extensionOptions.extensions!.push(frontmatter("yaml"));
		extensionOptions.mdastExtensions!.push(frontmatterFromMarkdown("yaml"));
	}
	if (syntax.gfm !== false) {
		extensionOptions.extensions!.push(gfm());
		extensionOptions.mdastExtensions!.push(gfmFromMarkdown());
	}
	if (syntax.math !== false) {
		extensionOptions.extensions!.push(math());
		extensionOptions.mdastExtensions!.push(mathFromMarkdown());
	}
	if (syntax.directive === true) {
		extensionOptions.extensions!.push(directive());
		extensionOptions.mdastExtensions!.push(directiveFromMarkdown());
	}
	if (syntax.html !== false) {
		extensionOptions.mdastExtensions!.push(
			htmlFromMarkdown({
				warnForDisallowedElement: options.warning?.disallowedElement !== false,
			}),
		);
	}
	extensionOptions.mdastExtensions!.push(buildDisableExtensions(syntax));
	return extensionOptions;
}

interface AllNodeMap extends RootContentMap {
	root: Root;
	[key: string]: Root | RootContent;
}

export function parseMarkdown(markdown: string, options: ParseOptions = {}): MD.Document {
	const ast = fromMarkdown(markdown, prepareExtensions(options));
	let metaString: string | undefined;
	const definitions: Record<string, MD.Definition> = {};
	const footnotes: Record<string, MD.FootnoteDefinition> = {};
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
	walker.on("enter", "text", (node, ctx) => {
		// Merge adjacent text nodes to simplify the tree
		if (ctx.previousSibling?.type === "text") {
			ctx.previousSibling.value += node.value;
			ctx.previousSibling.pos![1] = node.pos![1];
			ctx.remove();
		}
	});
	walker.on("enter", "definition", (node, ctx) => {
		setWhenUnset(definitions, node.identifier, node as unknown as MD.Definition);
		ctx.remove();
	});
	walker.on("enter", "footnoteDefinition", (node, ctx) => {
		setWhenUnset(footnotes, node.identifier, node as unknown as MD.FootnoteDefinition);
		ctx.remove();
	});
	const newRoot = walker.execute(ast);
	return {
		type: "root",
		children: (newRoot as Root).children as unknown as MD.Nodes[],
		pos: newRoot.pos,
		meta: metaString,
		definitions,
		footnotes,
	};
}

function positionToPos(position: Position): [start: number, end: number] {
	return [position.start.offset!, position.end.offset!];
}
