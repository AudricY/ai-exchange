export interface Document {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  injectTimestamp: number;
  chunks: DocChunk[];
}

export interface DocChunk {
  id: string; // e.g., "DOC-001-CHK-003"
  docId: string;
  index: number;
  content: string;
}
