import { calculateRevisionHash } from "./revision" with { type: "macro" };
import { Walker, Walker as WalkerClass } from "./walker";
import type { MD } from "./types";

export interface NodeWalker extends WalkerClass<
	MD.NodeMap & { root: MD.Document } & { [key: string]: MD.Nodes }
> {}
export const NodeWalker = Walker as {
	new (): NodeWalker;
};

export const parserRevision = calculateRevisionHash("./parser.ts");

export * from "./parser";
export { collectText } from "./utils";
export { selfClosingTags } from "./html";
export type { MD };
