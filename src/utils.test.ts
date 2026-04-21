import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./parser";
import { collectText } from "./utils";

describe("collectText", () => {
	test("collects text node values", () => {
		const doc = parseMarkdown("Hello **world**");
		expect(collectText(doc)).toBe("Hello world");
	});

	test("uses alt from markdown image nodes", () => {
		const doc = parseMarkdown("![diagram alt](https://example.com/a.png)");
		expect(collectText(doc)).toBe("diagram alt");
	});

	test("uses alt from html img elements", () => {
		const doc = parseMarkdown('<img src="/logo.png" alt="company logo"> text');
		expect(collectText(doc)).toBe("company logo text");
	});

	test("ignores svg subtree text", () => {
		const doc = parseMarkdown("<svg><text>hidden</text></svg> visible");
		expect(collectText(doc)).toContain("visible");
		expect(collectText(doc)).not.toContain("hidden");
	});

	test("keeps single newline semantics for html line breaks", () => {
		const doc = parseMarkdown("<div>a<br>b</div>");
		expect(collectText(doc)).toBe("a\nb");
	});

	test("does not inflate blank lines around thematic breaks", () => {
		const doc = parseMarkdown("a\n\n---\n\nb");
		expect(collectText(doc)).toBe("a\n\nb");
	});

	test("treats common block html tags as block boundaries", () => {
		const doc = parseMarkdown("<section>one</section><article>two</article><p>three</p>");
		expect(collectText(doc)).toBe("one\ntwo\nthree");
	});
});
