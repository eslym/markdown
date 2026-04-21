interface ReplaceOptions {
	/**
	 * Whether to walk the replacement node(s) like normal nodes. By default,
	 * if a node is replaced, the replacement will not be walked,
	 * @default true
	 */
	walkReplacement?: boolean;
	/**
	 * Stop passing current node to other listeners after this replacement.
	 * By default, if a node is replaced, it will not be passed to the remaining listeners,
	 * but the replacement will be passed to the remaining listeners if `walkReplacement` is true.
	 * @default true
	 */
	stop?: boolean;
}

type TransformResult =
	| {
			type: "remove";
			stop: boolean;
	  }
	| {
			type: "replace";
			node: NodeLike[];
			walkReplacement: boolean;
			stop: boolean;
	  }
	| {
			type: "none";
	  };

interface NodeLike {
	type: string;
	children?: unknown[];
}

class WalkContext<NodeType extends NodeLike = NodeLike> {
	#removed = false;
	#stop = false;
	#replacement: NodeType[] | undefined;
	#walkReplacement = true;
	#getPrev: () => NodeType | undefined;
	#getNext: () => NodeType | undefined;
	#parents: readonly NodeType[];

	get parents() {
		return this.#parents;
	}

	get previousSibling(): NodeType | undefined {
		return this.#getPrev();
	}
	get nextSibling(): NodeType | undefined {
		return this.#getNext();
	}

	get removed() {
		return this.#removed;
	}

	get replaced() {
		return !this.#removed && this.#replacement !== undefined;
	}

	get stop() {
		return this.#stop;
	}

	constructor(
		parents: readonly NodeType[],
		getPrev: () => NodeType | undefined,
		getNext: () => NodeType | undefined,
	) {
		this.#parents = Object.freeze(parents);
		this.#getPrev = getPrev;
		this.#getNext = getNext;
	}

	remove(stop = true) {
		this.#removed = true;
		this.#stop = stop;
	}

	replaceWith(node: NodeType | NodeType[], options: ReplaceOptions = {}) {
		this.#replacement = Array.isArray(node) ? node : [node];
		this.#walkReplacement = options.walkReplacement ?? true;
		this.#stop = options.stop ?? true;
	}

	result(): TransformResult {
		if (this.#removed) {
			return { type: "remove", stop: this.#stop };
		}
		if (this.#replacement) {
			return {
				type: "replace",
				node: this.#replacement,
				walkReplacement: this.#walkReplacement,
				stop: this.#stop,
			};
		}
		return { type: "none" };
	}
}

type Callback<T extends NodeLike = NodeLike, NodeType extends NodeLike = NodeLike> = (
	node: T,
	context: WalkContext<NodeType>,
) => void;

export class Walker<NodeMap extends Record<string, NodeLike>> {
	#entering = new Set<Callback>();
	#exiting = new Set<Callback>();

	on(
		event: "enter" | "exit",
		cb: Callback<NodeMap[keyof NodeMap], NodeMap[keyof NodeMap]>,
	): () => void;
	on<T extends keyof NodeMap>(
		event: "enter" | "exit",
		type: T,
		cb: Callback<NodeMap[T], NodeMap[keyof NodeMap]>,
	): () => void;
	on(
		event: "enter" | "exit",
		...args: [type: keyof NodeMap, callback: Callback<any, any>] | [callback: Callback<any, any>]
	): () => void {
		const listeners = event === "enter" ? this.#entering : this.#exiting;
		if (args.length === 1) {
			const [cb] = args;
			listeners.add(cb);
			return () => void listeners.delete(cb);
		}
		const [type, cb] = args;
		const wrapper: Callback = (node, transform) => {
			if (node.type === type) {
				cb(node as NodeMap[typeof type], transform);
			}
		};
		listeners.add(wrapper);
		return () => void listeners.delete(wrapper);
	}

	execute(node: NodeMap[keyof NodeMap]): NodeMap[keyof NodeMap] {
		const noop = () => undefined;
		const result = this.#execute(node, [], noop, noop, new Set());
		switch (result.type) {
			case "remove":
				throw new Error("Cannot remove root node");
			case "replace":
				if (result.node.length !== 1) {
					throw new Error("Cannot replace root node with multiple nodes");
				}
				node = result.node[0] as NodeMap[keyof NodeMap];
				if (result.walkReplacement) {
					return this.execute(node);
				}
				break;
		}
		return node;
	}

	#execute(
		node: NodeLike,
		parents: readonly NodeLike[],
		prev: () => NodeLike | undefined,
		next: () => NodeLike | undefined,
		walked: Set<NodeLike>,
	): TransformResult {
		if (walked.has(node)) {
			throw new Error("Circular reference detected in AST");
		}
		walked.add(node);
		const context = new WalkContext(parents, prev, next);
		for (const cb of this.#entering) {
			cb(node, context);
			if (context.stop) break;
		}
		if (context.removed || context.replaced) return context.result();
		if ("children" in node && node.children?.length) {
			let i = 0;
			const p = [...parents, node];
			const prev = () => (i > 0 ? node.children![i - 1] : undefined);
			const next = () => (i < node.children!.length - 1 ? node.children![i + 1] : undefined);
			while (i < node.children.length) {
				const child = node.children[i]!;
				const result = this.#execute(child as any, p, prev as any, next as any, walked);
				switch (result.type) {
					case "remove":
						node.children.splice(i, 1);
						break;
					case "replace":
						node.children.splice(i, 1, ...result.node);
						if (!result.walkReplacement) {
							i += result.node.length;
						}
						break;
					case "none":
						i++;
						break;
				}
			}
		}
		for (const cb of this.#exiting) {
			cb(node, context);
			if (context.stop) return context.result();
		}
		return context.result();
	}
}
