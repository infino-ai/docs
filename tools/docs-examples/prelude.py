# Stands in for the context a guide's Python fragments assume: an open
# connection, a schema, a table with a full-text and a vector column, and the
# `embed` helper the pages use for a query vector. Nothing here is executed — it
# exists so the fragments below it type-check against the published package's
# real signatures.
from typing import Any, List

import infino
import pyarrow as pa

DIM = 384

db = infino.connect("memory://")

schema = pa.schema(
    [
        pa.field("doc_id", pa.large_utf8(), nullable=False),
        pa.field("source", pa.large_utf8(), nullable=False),
        pa.field("body", pa.large_utf8(), nullable=False),
        pa.field("embedding", pa.list_(pa.float32(), DIM), nullable=False),
    ]
)

docs = db.create_table(
    "docs", schema, infino.IndexSpec().fts("body").vector("embedding", DIM, "cosine")
)


def embed(_text: str) -> List[float]:
    return [0.0] * DIM


# A query vector by its other common name on these pages.
q: List[float] = embed("query")

# Values a fragment may reference without introducing them: a table handle under
# its other common name, and a batch of rows to append.
table = docs
text: str = "Refunds return to the original payment method."
rows: List[Any] = []
