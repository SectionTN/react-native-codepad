export const python = `"""Small cache helpers used by the sync job."""
from dataclasses import dataclass
from functools import lru_cache
import re

TOKEN = re.compile(r"[A-Za-z_]\\w*")


@dataclass(frozen=True)
class Entry:
    key: str
    value: int = 0

    def label(self) -> str:
        return f"{self.key}={self.value:04d}"


@lru_cache(maxsize=128)
def tokens(text: str) -> list[str]:
    return [m.group(0) for m in TOKEN.finditer(text) if not m.group(0).startswith("_")]


if __name__ == "__main__":
    entries = {name: Entry(name, len(name)) for name in tokens("alpha beta _skip gamma")}
    print(", ".join(e.label() for e in entries.values()))
`;
