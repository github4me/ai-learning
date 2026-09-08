"""Shared data entry for Weeks 6–12. Importing does not train or write files."""
from dataclasses import dataclass
import string
import sys


def configure_console():
    """Entrypoints opt in to UTF-8 so Chinese examples work in Windows pipes."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


@dataclass(frozen=True)
class TokenCodec:
    tokens: tuple[str, ...]
    mode: str = "word"

    def __post_init__(self):
        if self.mode not in ("word", "character"):
            raise ValueError("mode must be word or character")
        if not self.tokens or len(set(self.tokens)) != len(self.tokens):
            raise ValueError("vocabulary must be nonempty and contain unique entries")
        if any(not isinstance(token, str) or not token for token in self.tokens):
            raise ValueError("tokens must be nonempty strings")
        if self.mode == "character" and any(len(token) != 1 for token in self.tokens):
            raise ValueError("character vocabulary entries must be single characters")

    def encode(self, text: str) -> list[int]:
        pieces = text.split() if self.mode == "word" else list(text)
        mapping = {token: index for index, token in enumerate(self.tokens)}
        unknown = sorted(set(pieces) - mapping.keys())
        if unknown:
            raise ValueError(f"Unknown tokens {unknown!r}; do not silently rebuild the vocabulary")
        return [mapping[piece] for piece in pieces]

    def decode(self, ids: list[int]) -> str:
        if any(type(index) is not int or not 0 <= index < len(self.tokens) for index in ids):
            raise ValueError("IDs must be integer addresses inside this vocabulary")
        pieces = [self.tokens[index] for index in ids]
        return (" " if self.mode == "word" else "").join(pieces)


FIVE_WORD_TOKENIZER = TokenCodec(("我", "喜欢", "AI", "学习", "猫"))
DEMO_DOCUMENTS = ("我 喜欢 AI", "猫 喜欢 我", "我 学习 AI")
# Independently specified alphabet, not inferred from validation documents.
# No UNK/PAD/BOS/EOS. Character mode preserves every allowed character.
DOCUMENT_TOKENIZER = TokenCodec(tuple(string.ascii_lowercase + " .,\n"), "character")


def make_windows(documents, tokenizer: TokenCodec, block_size: int, stride: int = 1):
    """Build windows inside each document; never join documents or splits."""
    if type(block_size) is not int or block_size < 1 or type(stride) is not int or stride < 1:
        raise ValueError("block_size and stride must be positive integers")
    inputs, targets = [], []
    for doc_number, text in enumerate(documents):
        ids = tokenizer.encode(text)
        if len(ids) < block_size + 1:
            raise ValueError(f"Document {doc_number} has {len(ids)} tokens; need T+1={block_size + 1}")
        for start in range(0, len(ids) - block_size, stride):
            chunk = ids[start:start + block_size + 1]
            inputs.append(chunk[:-1])
            targets.append(chunk[1:])
    if not inputs:
        raise ValueError("No documents/windows supplied")
    return inputs, targets
