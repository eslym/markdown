import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./parser";
import type { MD } from "./types";

describe("parseMarkdown", () => {
	test("ignores stray closing tags", () => {
		const doc = parseMarkdown("before\n\n</div>\n\nafter");
		const paragraphs = doc.children.filter((node) => node.type === "paragraph");

		expect(paragraphs).toHaveLength(2);
		expect(getText(paragraphs[0]!)).toBe("before");
		expect(getText(paragraphs[1]!)).toBe("after");
		expect(findElements(doc.children, "div")).toHaveLength(0);
	});

	test("drops html/head/body tags but keeps child content", () => {
		const doc = parseMarkdown("<body><p>Hello</p></body>");
		const forbidden = ["html", "head", "body"];

		for (const tag of forbidden) {
			expect(findElements(doc.children, tag)).toHaveLength(0);
		}

		const paragraph = findElements(doc.children, "p")[0];
		expect(paragraph).toBeDefined();
		expect(getText(paragraph!)).toContain("Hello");
	});

	test("preserves script/style text without parsing inner tags", () => {
		const doc = parseMarkdown(
			"<script>if (a < b) { call('&lt;'); }</script>\n<style>.x::before { content: '&lt;'; }</style>",
		);

		const script = findElements(doc.children, "script")[0];
		expect(script).toBeDefined();
		expect(script!.children).toHaveLength(1);
		expect(script!.children[0]!.type).toBe("text");
		expect(getText(script!)).toContain("a < b");
		expect(getText(script!)).toContain("&lt;");

		const style = findElements(doc.children, "style")[0];
		expect(style).toBeDefined();
		expect(style!.children).toHaveLength(1);
		expect(style!.children[0]!.type).toBe("text");
		expect(getText(style!)).toContain("&lt;");
	});

	test("decodes textarea text without parsing inner tags", () => {
		const doc = parseMarkdown("<textarea>&lt;b&gt;x&lt;/b&gt; and a < b</textarea>");

		const textarea = findElements(doc.children, "textarea")[0];
		expect(textarea).toBeDefined();
		expect(textarea!.children).toHaveLength(1);
		expect(textarea!.children[0]!.type).toBe("text");
		expect(getText(textarea!)).toContain("<b>x</b>");
		expect(getText(textarea!)).toContain("a < b");
	});

	test("skips disallowed nesting checks inside template", () => {
		const warns: string[] = [];
		const originalWarn = console.warn;
		console.warn = (message?: unknown) => {
			warns.push(String(message));
		};

		try {
			parseMarkdown("<p><div>outside</div></p>");
			const before = warns.length;

			parseMarkdown("<template><p><div>inside</div></p></template>");
			const after = warns.length;

			expect(before).toBeGreaterThan(0);
			expect(after).toBe(before);
		} finally {
			console.warn = originalWarn;
		}
	});

	test("disables thematic breaks when syntax.thematicBreak is false", () => {
		const enabled = parseMarkdown("a\n\n---\n\nb");
		const disabled = parseMarkdown("a\n\n---\n\nb", {
			syntax: {
				thematicBreak: false,
			},
		});

		expect(hasType(enabled.children, "thematicBreak")).toBe(true);
		expect(hasType(disabled.children, "thematicBreak")).toBe(false);
	});

	test("disables html token parsing when syntax.html is false", () => {
		const enabled = parseMarkdown("<div>x</div>");
		const disabled = parseMarkdown("<div>x</div>", {
			syntax: {
				html: false,
			},
		});

		expect(findElements(enabled.children, "div")).toHaveLength(1);
		expect(findElements(disabled.children, "div")).toHaveLength(0);
	});

	test("disables gfm table when syntax.gfm.table is false", () => {
		const markdown = "| a |\n| - |\n| b |";
		const enabled = parseMarkdown(markdown);
		const disabled = parseMarkdown(markdown, {
			syntax: {
				gfm: {
					table: false,
				},
			},
		});

		expect(hasType(enabled.children, "table")).toBe(true);
		expect(hasType(disabled.children, "table")).toBe(false);
	});
});

function findElements(nodes: MD.Nodes[], tagName: string) {
	const found: MD.Nodes[] = [];
	const stack = [...nodes];

	while (stack.length > 0) {
		const node = stack.pop()!;
		if (node.type === "element") {
			if (node.tagName === tagName) {
				found.push(node);
			}
			stack.push(...node.children);
		} else if ("children" in node) {
			stack.push(...node.children);
		}
	}

	return found as Extract<MD.Nodes, { type: "element" }>[];
}

function getText(node: MD.Nodes | MD.Document): string {
	if (!("children" in node)) {
		return "";
	}

	let value = "";
	for (const child of node.children) {
		if (child.type === "text") {
			value += child.value;
		} else if ("children" in child) {
			value += getText(child);
		}
	}

	return value;
}

function hasType(nodes: MD.Nodes[], type: string): boolean {
	const stack = [...nodes];
	while (stack.length > 0) {
		const node = stack.pop()!;
		if (node.type === type) {
			return true;
		}
		if ("children" in node) {
			stack.push(...node.children);
		}
	}
	return false;
}
