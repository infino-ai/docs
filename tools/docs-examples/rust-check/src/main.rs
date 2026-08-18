#![allow(unused_variables, unused_imports, unused_mut, dead_code, unreachable_code)]

fn main() -> Result<(), Box<dyn std::error::Error>> {
// Stands in for the context a guide's Rust fragments assume: an open
// connection, a schema, a table with a full-text and a vector column, and the
// `embed` helper the pages use for a query vector. Nothing here runs — the lane
// only compiles, so the fragments below are checked against the published
// crate's real signatures.
//
// These live inside the assembled `fn main`, which is legal, and means a page's
// own hoisted imports at file scope never collide with them.
use std::sync::Arc;

use infino::arrow_array::RecordBatch;
use infino::arrow_schema::{DataType, Field, Schema};
use infino::{
    Bm25SearchOptions, BoolMode, ConnectOptions, IndexSpec, Metric, VectorFilter, connect,
    connect_with,
};

let db = infino::connect("memory://")?;

let item = Arc::new(Field::new("item", DataType::Float32, true));
let schema = Arc::new(Schema::new(vec![
    Field::new("doc_id", DataType::LargeUtf8, false),
    Field::new("source", DataType::LargeUtf8, false),
    Field::new("body", DataType::LargeUtf8, false),
    Field::new("embedding", DataType::FixedSizeList(item, 384), false),
]));

let docs = db.create_table(
    "docs",
    schema.clone(),
    IndexSpec::new().fts("body").vector("embedding", 384, Metric::Cosine),
)?;

fn embed(_text: &str) -> Vec<f32> {
    vec![0.0; 384]
}

// The pages build a RecordBatch called `batch` off-camera and say so in prose.
let batch = RecordBatch::new_empty(schema.clone());

// A query vector by its other common name on these pages.
let q: Vec<f32> = embed("query");

// Keep the prelude's own bindings used, so an unused-variable warning never
// masks a real one from a fragment.
let _ = (&db, &docs, &schema, &batch, &q, embed("warm"));

    // sql-reference.mdx block 1
    {
let rows = db.query_sql("SELECT body FROM docs WHERE source = 'help-center'")?;

    }
    Ok(())
}
