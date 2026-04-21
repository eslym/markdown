import type { Extension } from "mdast-util-from-markdown";
import type { SyntaxOptions } from "./parser";

const noop = () => undefined;

const disables: Record<string, string[]> = {
	link: ["link"],
	image: ["image"],
	autolink: ["autolink"],
	autolinkEmail: ["autolinkEmail"],
	autolinkProtocol: ["autolinkProtocol"],
	heading: ["atxHeading", "setextHeading"],
	list: ["listOrdered", "listUnordered"],
	reference: ["reference", "definition"],
	code: ["codeFenced", "codeIndented"],
	thematicBreak: ["thematicBreak"],
	blockquote: ["blockQuote"],
	html: ["htmlFlow", "htmlFlowData", "htmlText", "htmlTextData"],
	// --- GFM ---
	gfmTable: ["table"],
	gfmTaskList: ["taskListCheckValueChecked", "taskListCheckValueUnchecked"],
	gfmAutolink: ["literalAutolink"],
	gfmAutolinkEmail: ["literalAutolinkEmail"],
	gfmAutolinkHttp: ["literalAutolinkHttp"],
	gfmAutolinkWww: ["literalAutolinkWww"],
	gfmFootnote: [
		"gfmFootnoteCallString",
		"gfmFootnoteCall",
		"gfmFootnoteDefinitionString",
		"gfmFootnoteDefinition",
	],
};

function constructDisabled(disabled: string[]): Extension {
	const handlers: Record<string, () => void> = {};
	for (const feature of disabled) {
		const tokens = disables[feature];
		if (tokens) {
			for (const token of tokens) {
				handlers[token] = noop;
			}
		}
	}
	return {
		enter: handlers,
		exit: handlers,
	};
}

export function buildDisableExtensions(options: SyntaxOptions): Extension {
	const disabledSyntax = new Set<string>();

	if (options.link === false) {
		disabledSyntax.add("link");
	}
	if (options.image === false) {
		disabledSyntax.add("image");
	}
	if (options.heading === false) {
		disabledSyntax.add("heading");
	}
	if (options.list === false) {
		disabledSyntax.add("list");
	}
	if (options.reference === false) {
		disabledSyntax.add("reference");
	}
	if (options.code === false) {
		disabledSyntax.add("code");
	}
	if (options.thematicBreak === false) {
		disabledSyntax.add("thematicBreak");
	}
	if (options.blockquote === false) {
		disabledSyntax.add("blockquote");
	}
	if (options.html === false) {
		disabledSyntax.add("html");
	}

	checkDisabled(
		options.autolink,
		["email", "protocol"],
		() => disabledSyntax.add("autolink"),
		(partial) => {
			if (partial.email === false) {
				disabledSyntax.add("autolinkEmail");
			}
			if (partial.protocol === false) {
				disabledSyntax.add("autolinkProtocol");
			}
		},
	);

	if (options.gfm && typeof options.gfm === "object") {
		if (options.gfm.table === false) {
			disabledSyntax.add("gfmTable");
		}
		if (options.gfm.taskList === false) {
			disabledSyntax.add("gfmTaskList");
		}
		if (options.gfm.footnote === false) {
			disabledSyntax.add("gfmFootnote");
		}
		checkDisabled(
			options.gfm.autolink,
			["email", "http", "www"],
			() => disabledSyntax.add("gfmAutolink"),
			(partial) => {
				if (partial.email === false) {
					disabledSyntax.add("gfmAutolinkEmail");
				}
				if (partial.http === false) {
					disabledSyntax.add("gfmAutolinkHttp");
				}
				if (partial.www === false) {
					disabledSyntax.add("gfmAutolinkWww");
				}
			},
		);
	}

	return constructDisabled([...disabledSyntax]);
}

function checkDisabled<T extends Record<string, boolean | undefined>>(
	record: T | boolean | null | undefined,
	keys: (keyof T)[],
	allDisabled: () => void,
	partiallyDisabled: (partial: T) => void,
) {
	if (record === false) {
		return allDisabled();
	}
	if (record && typeof record === "object") {
		let allDisabledInKeys = true;
		for (const key of keys) {
			if (record[key] !== false) {
				allDisabledInKeys = false;
				break;
			}
		}
		if (allDisabledInKeys) {
			return allDisabled();
		}
		return partiallyDisabled(record);
	}
}
