import { join, dirname, sep, extname } from "node:path";
import { readFileSync } from "node:fs";

class CalculateRevisionError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "CalculateRevisionError";
	}
}

export function calculateRevisionHash(path: string): string {
	const bunLock = Bun.JSONC.parse(
		readFileSync(join(import.meta.dirname, "../bun.lock"), "utf-8"),
	) as Bun.BunLockFile;
	const nodeModules = findNodeModules();
	const resolved = new Set<string>();
	return calculateDependencyHash(path, import.meta.path, {
		bunLock,
		nodeModules,
		resolved,
	})!
		.hash.toString(16)
		.padStart(16, "0");
}

export function calculateDependencyHash(
	path: string,
	parent: string,
	ctx: {
		bunLock: Bun.BunLockFile;
		nodeModules: string;
		resolved: Set<string>;
	},
):
	| {
			id: string;
			hash: bigint;
	  }
	| undefined {
	const id = Bun.resolveSync(path, dirname(parent));
	if (ctx.resolved.has(id)) {
		// skip already resolved dependencies to avoid infinite recursion on circular dependencies
		return undefined;
	} else if (id.startsWith("node:")) {
		throw new CalculateRevisionError(
			`Cannot calculate hash for built-in module "${id}". Please ensure all dependencies are installed and resolvable.`,
		);
	} else if (id.startsWith(ctx.nodeModules)) {
		const parts = id.slice(ctx.nodeModules.length).split(sep);
		const pkg = parts[0]!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
		return {
			id,
			hash: Bun.hash.xxHash64(ctx.bunLock.packages[pkg]!.at(-1) as string),
		};
	}
	ctx.resolved.add(id);
	const transpiler = new Bun.Transpiler();
	const loader = extname(id).slice(1) as Bun.JavaScriptLoader;
	let code: string;
	try {
		code = transpiler.transformSync(readFileSync(id, "utf-8"), loader);
	} catch (e) {
		if (e instanceof CalculateRevisionError) {
			throw e;
		}
		throw new CalculateRevisionError(`Failed to calculate hash for "${id}"`, { cause: e });
	}
	return {
		id,
		hash: transpiler
			.scanImports(code)
			.map((i) => calculateDependencyHash(i.path, id, ctx))
			.filter((h): h is { id: string; hash: bigint } => h !== undefined)
			.sort((a, b) => a.id.localeCompare(b.id, "en-US"))
			.reduce(
				(a, b) => Bun.hash.xxHash64(new BigUint64Array([b.hash]), a),
				Bun.hash.xxHash64(code),
			),
	};
}

function findNodeModules() {
	const typescript = join("typescript", "lib", "typescript.js");
	const resolved = Bun.resolveSync("typescript", import.meta.dirname);
	if (!resolved.endsWith(typescript)) {
		throw new Error(
			`Expected to resolve "typescript" to a path ending with "${typescript}", but got "${resolved}".`,
		);
	}
	return resolved.slice(0, -typescript.length);
}
