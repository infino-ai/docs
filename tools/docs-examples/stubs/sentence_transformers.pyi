# Declared rather than installed: the check exists to catch drift in Infino's
# own API, and pulling a full embedding runtime in for its types would dominate
# the install for no added signal.
from typing import Any, List

class SentenceTransformer:
    def __init__(self, model_name_or_path: str, *args: Any, **kwargs: Any) -> None: ...
    def encode(self, sentences: Any, *args: Any, **kwargs: Any) -> Any: ...
