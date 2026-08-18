// Stands in for the context a guide's fragments assume: an open connection, a
// table with a full-text and a vector column, and the `embed` helper the pages
// use for a query vector. Nothing here is executed — it exists so the
// fragments below it compile against the published binding's real types.
import { connect, IndexSpec } from "@infino-ai/infino";

const DIM = 16;

const db = connect("memory://");

const docs = db.createTable(
  "docs",
  { doc_id: "utf8", source: "large_utf8", body: "large_utf8", embedding: { vector: DIM } },
  new IndexSpec().fts("body").vector("embedding", DIM, "cosine"),
);

const embed = (_text: string): number[] => Array(DIM).fill(0);

// A query vector by its other common name on these pages.
const q: number[] = embed("query");

// Keep the prelude's own bindings "used" so an unused-locals setting can be
// turned on later without this file failing first.
void db;
void docs;
void embed;
void q;
