# Declared rather than installed, like the other stubs here: the check exists to
# catch drift in Infino's own API, and a PDF library's types add no signal to it.
from typing import Any, List

class PageObject:
    def extract_text(self, *args: Any, **kwargs: Any) -> str: ...

class PdfReader:
    pages: List[PageObject]
    def __init__(self, stream: Any, *args: Any, **kwargs: Any) -> None: ...
