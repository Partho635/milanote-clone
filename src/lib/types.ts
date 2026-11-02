export type CardType =
  | "note"
  | "todo"
  | "link"
  | "image"
  | "file"
  | "board"
  | "column"
  | "comment"
  | "sketch"
  | "swatch"
  | "table"
  | "document"
  | "heading"
  | "map";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  due?: string; // yyyy-mm-dd
  assignee?: string;
  labels?: string[];
  reactions?: Record<string, number>;
}
export interface Cell {
  v: string;
  bg?: string;
  color?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}
export interface Label {
  id: string;
  name: string;
  color: string;
}
export interface CommentItem {
  id: string;
  author: string;
  text: string;
  at: number;
}
export interface Stroke {
  d: [number, number][];
  color: string;
  size: number;
}

export interface CardData {
  html?: string; // note, document
  title?: string; // todo, column, document
  items?: TodoItem[]; // todo
  url?: string; // link, image, file
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  status?: "idle" | "loading" | "done" | "error";
  caption?: string; // image
  natW?: number;
  natH?: number;
  name?: string; // file, swatch
  size?: number;
  mime?: string;
  boardId?: string; // board card
  collapsed?: boolean; // column
  comments?: CommentItem[];
  strokes?: Stroke[]; // sketch
  vbW?: number;
  vbH?: number;
  color?: string; // swatch
  rows?: string[][]; // legacy table
  cells?: Cell[][]; // table
  showTitle?: boolean; // todo
  hidePreview?: boolean; // link
  customTitle?: string; // link
  showCaption?: boolean; // link / image
  cardView?: boolean; // document
  query?: string; // map
  hsize?: "s" | "m" | "l"; // heading
}

export interface Card {
  id: string;
  type: CardType;
  boardId: string;
  parentId: string | null; // column id when stacked in a column
  order: number;
  x: number;
  y: number;
  w: number;
  h?: number; // only for sketch
  z: number;
  color: string; // palette key
  data: CardData;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  locked?: boolean;
  unsorted?: boolean;
  colorMode?: "bg" | "strip";
  labels?: string[];
  reactions?: Record<string, number>;
  comments?: CommentItem[];
}

export interface Endpoint {
  cardId: string | null;
  x: number;
  y: number;
}

export interface Line {
  id: string;
  boardId: string;
  from: Endpoint;
  to: Endpoint;
  cx: number; // control-point offset from the straight midpoint
  cy: number;
  color: string;
  width: number;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  label: string;
}

export interface Board {
  id: string;
  title: string;
  icon: string;
  createdAt: number;
}

export interface Settings {
  userName: string;
  theme: "light" | "dark";
  snap: boolean;
  showGrid: boolean;
}

export interface Workspace {
  version: 1;
  boards: Record<string, Board>;
  cards: Record<string, Card>;
  lines: Record<string, Line>;
  settings: Settings;
  labels: Label[];
  people: string[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type DropTarget =
  | { kind: "column"; id: string; index: number }
  | { kind: "board"; id: string }
  | { kind: "trash" }
  | { kind: "unsorted" }
  | null;

export type Modal =
  | null
  | { type: "search" }
  | { type: "templates" }
  | { type: "trash" }
  | { type: "settings" }
  | { type: "shortcuts" }
  | { type: "document"; id: string }
  | { type: "image"; id: string }
  | { type: "share" };
