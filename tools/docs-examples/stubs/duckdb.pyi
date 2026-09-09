# Declared rather than installed: the check exists to catch drift in Infino's
# own API, and DuckDB appears on these pages only as an independent reader of
# the produced Parquet files.
from typing import Any

def sql(query: str, *args: Any, **kwargs: Any) -> Any: ...
