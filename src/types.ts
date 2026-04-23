import type { RootContentMap } from "mdast";

type Nullable<T> = T | null | undefined;

export namespace MD {
	export interface Node {
		type: string;
		pos?: [start: number, end: number] | undefined;
	}

	export interface Parent extends Node {
		children: Nodes[];
	}

	export interface Literal extends Node {
		value: string;
	}

	export interface BlockQuote extends Node {
		type: "blockquote";
	}

	export interface Break extends Node {
		type: "break";
	}

	export interface Code extends Literal {
		type: "code";
		lang?: Nullable<string>;
		meta?: Nullable<string>;
	}

	export interface Definition extends Node {
		type: "definition";
		identifier: string;
		url: string;
		title?: Nullable<string>;
	}

	export interface Delete extends Parent {
		type: "delete";
	}

	export interface Emphasis extends Parent {
		type: "emphasis";
	}

	export interface FootnoteDefinition extends Parent {
		type: "footnoteDefinition";
		identifier: string;
	}

	export interface FootnoteReference extends Node {
		type: "footnoteReference";
		identifier: string;
	}

	export interface Heading extends Parent {
		type: "heading";
		depth: 1 | 2 | 3 | 4 | 5 | 6 | (number & {});
	}

	export interface Image extends Node {
		type: "image";
		url: string;
		title?: Nullable<string>;
		alt?: Nullable<string>;
	}

	export interface ImageReference extends Node {
		type: "imageReference";
		identifier: string;
		alt?: Nullable<string>;
	}

	export interface InlineCode extends Literal {
		type: "inlineCode";
	}

	export interface Link extends Parent {
		type: "link";
		url: string;
		title?: Nullable<string>;
	}

	export interface LinkReference extends Parent {
		type: "linkReference";
		identifier: string;
	}

	export interface List extends Parent {
		type: "list";
		ordered: boolean;
		start?: Nullable<number>;
		spread?: Nullable<boolean>;
	}

	export interface ListItem extends Parent {
		type: "listItem";
		checked?: Nullable<boolean>;
		spread?: Nullable<boolean>;
	}

	export interface Paragraph extends Parent {
		type: "paragraph";
	}

	export interface Strong extends Parent {
		type: "strong";
	}

	export interface Table extends Parent {
		type: "table";
		align?: Nullable<Array<Nullable<"left" | "right" | "center">>>;
		children: TableRow[];
	}

	export interface TableRow extends Parent {
		type: "tableRow";
		children: TableCell[];
	}

	export interface TableCell extends Parent {
		type: "tableCell";
	}

	export interface Text extends Literal {
		type: "text";
	}

	export interface ThematicBreak extends Node {
		type: "thematicBreak";
	}

	export interface InlineMath extends Literal {
		type: "inlineMath";
	}

	export interface Math extends Literal {
		type: "math";
	}

	export interface Element extends Parent {
		type: "element";
		tagName: string;
		properties?: Nullable<Record<string, string>>;
	}

	export interface Comment extends Literal {
		type: "comment";
	}

	export interface ContainerDirective extends Parent {
		type: "containerDirective";
		name: string;
		attributes?: Nullable<Record<string, Nullable<string>>>;
	}

	export interface leafDirective extends Parent {
		type: "leafDirective";
		name: string;
		attributes?: Nullable<Record<string, Nullable<string>>>;
	}

	export interface textDirective extends Parent {
		type: "textDirective";
		name: string;
		attributes?: Nullable<Record<string, Nullable<string>>>;
	}

	export interface NodeMap {
		blockquote: BlockQuote;
		break: Break;
		code: Code;
		definition: Definition;
		delete: Delete;
		emphasis: Emphasis;
		footnoteDefinition: FootnoteDefinition;
		footnoteReference: FootnoteReference;
		heading: Heading;
		image: Image;
		imageReference: ImageReference;
		inlineCode: InlineCode;
		link: Link;
		linkReference: LinkReference;
		list: List;
		listItem: ListItem;
		paragraph: Paragraph;
		strong: Strong;
		table: Table;
		tableRow: TableRow;
		tableCell: TableCell;
		text: Text;
		thematicBreak: ThematicBreak;
		inlineMath: InlineMath;
		math: Math;
		element: Element;
		comment: Comment;
		containerDirective: ContainerDirective;
		leafDirective: leafDirective;
		textDirective: textDirective;
	}

	export type Nodes = NodeMap[keyof NodeMap];

	export interface Document extends Parent {
		type: "root";
		meta?: Nullable<string>;
		definitions?: Nullable<Record<string, Definition>>;
		footnotes?: Nullable<Record<string, FootnoteDefinition>>;
	}
}

// type temp = Expand<RootContentMap["leafDirective"]>;

// type Expand<T> = {
// 	[K in keyof T]: T[K];
// } & {};

type _trimNever<T extends Record<string, any>> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K];
};
type _checksNever<T extends never> = T;
type _emptyRecord<T extends Record<string, never>> = T;
type _diffKeys<A extends Record<string, any>, B extends Record<string, any>> =
	| Exclude<keyof A, keyof B>
	| Exclude<keyof B, keyof A>;

type _missingKeys = _diffKeys<MD.NodeMap, Omit<RootContentMap, "html" | "yaml">>;
type _ensureAllNodesCovered = _checksNever<_missingKeys>;
type _checkNodeType = _emptyRecord<
	_trimNever<{
		[K in keyof MD.NodeMap]: MD.NodeMap[K] extends { type: K } ? never : unknown;
	}>
>;
