"""RFC 6902 subset patch application helpers for correction dry-run."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


ALLOWED_PATCH_OPS = {"add", "remove", "replace"}


class PatchError(ValueError):
    """Raised when patch application fails."""


def decode_json_pointer_token(token: str) -> str:
    decoded_chars: list[str] = []
    i = 0
    while i < len(token):
        ch = token[i]
        if ch != "~":
            decoded_chars.append(ch)
            i += 1
            continue
        if i + 1 >= len(token):
            raise PatchError("invalid JSON Pointer escape: trailing '~'")
        esc = token[i + 1]
        if esc == "0":
            decoded_chars.append("~")
        elif esc == "1":
            decoded_chars.append("/")
        else:
            raise PatchError(f"invalid JSON Pointer escape: '~{esc}'")
        i += 2
    return "".join(decoded_chars)


def parse_pointer(path: str) -> list[str]:
    if not path.startswith("/"):
        raise PatchError("path must start with /")
    return [decode_json_pointer_token(token) for token in path[1:].split("/")]


def _as_int_index(token: str) -> int:
    if token == "-":
        raise PatchError("'-' index is only allowed for add")
    try:
        return int(token)
    except ValueError as exc:
        raise PatchError(f"invalid array index token: {token!r}") from exc


def _get_parent_and_token(root: Any, pointer_tokens: list[str]) -> tuple[Any, str]:
    if not pointer_tokens:
        raise PatchError("empty pointer is not supported")
    node = root
    for token in pointer_tokens[:-1]:
        if isinstance(node, dict):
            if token not in node:
                raise PatchError(f"object key does not exist: {token!r}")
            node = node[token]
            continue
        if isinstance(node, list):
            index = _as_int_index(token)
            if index < 0 or index >= len(node):
                raise PatchError(f"array index out of bounds: {index}")
            node = node[index]
            continue
        raise PatchError("pointer traversal reached scalar value")
    return node, pointer_tokens[-1]


def apply_patch_op(root: Any, op: dict[str, Any]) -> None:
    op_name = op.get("op")
    path = op.get("path")
    if not isinstance(op_name, str) or op_name not in ALLOWED_PATCH_OPS:
        raise PatchError(f"unsupported op: {op_name!r}")
    if not isinstance(path, str):
        raise PatchError("path must be a string")

    tokens = parse_pointer(path)
    parent, token = _get_parent_and_token(root, tokens)

    if isinstance(parent, dict):
        if op_name == "add":
            parent[token] = op.get("value")
            return
        if op_name == "remove":
            if token not in parent:
                raise PatchError(f"object key not found for remove: {token!r}")
            del parent[token]
            return
        if op_name == "replace":
            if token not in parent:
                raise PatchError(f"object key not found for replace: {token!r}")
            parent[token] = op.get("value")
            return
        raise PatchError(f"unsupported op: {op_name!r}")

    if isinstance(parent, list):
        if op_name == "add":
            if token == "-":
                parent.append(op.get("value"))
                return
            index = _as_int_index(token)
            if index < 0 or index > len(parent):
                raise PatchError(f"array index out of bounds for add: {index}")
            parent.insert(index, op.get("value"))
            return
        index = _as_int_index(token)
        if index < 0 or index >= len(parent):
            raise PatchError(f"array index out of bounds: {index}")
        if op_name == "remove":
            parent.pop(index)
            return
        if op_name == "replace":
            parent[index] = op.get("value")
            return
        raise PatchError(f"unsupported op: {op_name!r}")

    raise PatchError("pointer parent is not container type")


def apply_patch(document: dict[str, Any], patch_ops: list[dict[str, Any]]) -> dict[str, Any]:
    patched = deepcopy(document)
    for op in patch_ops:
        apply_patch_op(patched, op)
    return patched

