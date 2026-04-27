import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";

const reset = "\u001b[0m";

const colors: Record<Bun.BuildOutput["logs"][number]["level"], string> = {
	error: Bun.color("red", "ansi") ?? "",
	warning: Bun.color("yellow", "ansi") ?? "",
	info: Bun.color("blue", "ansi") ?? "",
	debug: Bun.color("gray", "ansi") ?? "",
	verbose: Bun.color("gray", "ansi") ?? "",
};

function log(output: Bun.BuildOutput) {
	output.logs.forEach((log) => {
		const color = colors[log.level];
		console.log(`${color}[${log.level.toUpperCase()}] ${log.message}${reset}`);
	});
}

console.log("Building...");
await Bun.$`rm -rf dist`;

console.time("build browser bundle");
let out = await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist/browser",
	sourcemap: "linked",
	target: "browser",
	format: "esm",
	naming: { entry: "[name].mjs" },
});
console.timeEnd("build browser bundle");
log(out);

console.time("build node esm bundle");
out = await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	sourcemap: "linked",
	target: "node",
	format: "esm",
	naming: { entry: "[name].mjs" },
});
console.timeEnd("build node esm bundle");
log(out);

console.time("build node cjs bundle");
out = await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	sourcemap: "linked",
	target: "node",
	format: "cjs",
	naming: { entry: "[name].cjs" },
});
console.timeEnd("build node cjs bundle");
log(out);

console.time("build types");
await rollup({
	input: "src/index.ts",
	plugins: [dts()],
}).then((bundle) => bundle.write({ file: "dist/index.d.ts", format: "es", sourcemap: true }));
console.timeEnd("build types");
