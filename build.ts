import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";

await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	sourcemap: "linked",
	target: "browser",
	format: "esm",
	naming: { entry: "[name].mjs" },
});

await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	sourcemap: "linked",
	target: "browser",
	format: "cjs",
	naming: { entry: "[name].cjs" },
});

await rollup({
	input: "src/index.ts",
	plugins: [dts()],
}).then((bundle) => bundle.write({ file: "dist/index.d.ts", format: "es", sourcemap: "inline" }));
