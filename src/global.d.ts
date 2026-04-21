declare module "unist" {
	interface Node {
		pos?: [start: number, end: number] | undefined;
	}
}

declare module "mdast" {
	interface Element extends Parent {
		type: "element";
		tagName: string;
		properties?: Record<string, string> | undefined;
	}

	interface Comment extends Literal {
		type: "comment";
	}

	interface RootContentMap {
		element: Element;
		comment: Comment;
	}

	interface BlockContentMap {
		element: Element;
		comment: Comment;
	}

	interface PhrasingContentMap {
		element: Element;
		comment: Comment;
	}
}

export {};
