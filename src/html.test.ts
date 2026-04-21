import { describe, expect, test } from "bun:test";
import { tokenizeHTML } from "./html";

describe("tokenizeHTML special tags", () => {
	test("keeps script/style content raw", () => {
		const scriptTokens = [...tokenizeHTML('<script>x = "&lt;"; if (a < b) {}</script>')];
		const styleTokens = [...tokenizeHTML("<style>.x::before { content: '&lt;'; }</style>")];

		expect(scriptTokens.find((t) => t.type === "text")?.value).toContain("&lt;");
		expect(styleTokens.find((t) => t.type === "text")?.value).toContain("&lt;");
	});

	test("decodes textarea content", () => {
		const tokens = [...tokenizeHTML("<textarea>&lt;b&gt;x&lt;/b&gt; and a < b</textarea>")];
		expect(tokens.find((t) => t.type === "text")?.value).toBe("<b>x</b> and a < b");
	});
});
