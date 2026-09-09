# Declared rather than installed: the check exists to catch drift in Infino's
# own API, and pulling the datasets runtime in for its types would dominate
# the install for no added signal.
from typing import Any

def load_dataset(path: str, *args: Any, **kwargs: Any) -> Any: ...
