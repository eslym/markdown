import { calculateRevisionHash } from "./revision" with { type: "macro" };
import { Walker, Walker as WalkerClass } from "./walker";
import type { MD } from "./types";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export interface NodeWalker extends WalkerClass<Prettify<MD.NodeMap & { root: MD.Document }>> {}
export const NodeWalker = Walker as {
	new (): NodeWalker;
};

export const parserRevision = calculateRevisionHash("./parser.ts");

export * from "./parser";
export { collectText } from "./utils";
export { selfClosingTags } from "./html";
export type { MD };
