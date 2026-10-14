import hashlib
import os

import pytest

from bt_monitor import files


def _make(tmp_path):
    tree = tmp_path / "tree"
    (tree / "sub").mkdir(parents=True)
    (tree / "a.xml").write_text("<root/>")
    (tree / "sub" / "b.xml").write_text("<root/>")
    (tree / "c.txt").write_text("x")
    return tree


def test_lists_xml_recursively(tmp_path):
    tree = _make(tmp_path)
    listed = files.list_tree_files([str(tree)], [])
    assert [os.path.relpath(f.path, tree.resolve()) for f in listed] == [
        "a.xml",
        os.path.join("sub", "b.xml"),
    ]


def test_editable_only_under_edit_dir(tmp_path):
    tree = _make(tmp_path)
    listed = files.list_tree_files([str(tree)], [str(tree / "sub")])
    flags = {os.path.basename(f.path): f.editable for f in listed}
    assert flags == {"a.xml": False, "b.xml": True}


def test_id_is_stable(tmp_path):
    tree = _make(tmp_path)
    one = files.list_tree_files([str(tree)], [])
    two = files.list_tree_files([str(tree)], [])
    assert [f.id for f in one] == [f.id for f in two]
    assert all(len(f.id) == 16 for f in one)


def test_symlink_out_is_refused(tmp_path):
    tree = _make(tmp_path)
    outside = tmp_path / "outside.xml"
    outside.write_text("<root/>")
    (tree / "link.xml").symlink_to(outside)
    listed = files.list_tree_files([str(tree)], [])
    assert "link.xml" not in [os.path.basename(f.path) for f in listed]
    fid = hashlib.sha256(os.path.realpath(outside).encode()).hexdigest()[:16]
    assert files.resolve_tree_path([str(tree)], [], fid) is None


def test_unknown_id_is_none(tmp_path):
    tree = _make(tmp_path)
    assert files.resolve_tree_path([str(tree)], [], "nope") is None


def test_resolve_known_id(tmp_path):
    tree = _make(tmp_path)
    first = files.list_tree_files([str(tree)], [])[0]
    assert files.resolve_tree_path([str(tree)], [], first.id) == first


def test_read_returns_sha(tmp_path):
    p = tmp_path / "f.xml"
    data = "<root a='é'/>".encode()
    p.write_bytes(data)
    text, sha = files.read_tree(str(p))
    assert text == data.decode()
    assert sha == hashlib.sha256(data).hexdigest()


def test_write_keeps_mode_and_content(tmp_path):
    p = tmp_path / "f.xml"
    p.write_bytes(b"<root/>")
    os.chmod(p, 0o640)
    _, sha = files.read_tree(str(p))
    new = "<root>\r\n  é</root>\n"
    new_sha = files.write_tree(str(p), new, sha)
    assert p.read_bytes() == new.encode()
    assert new_sha == hashlib.sha256(new.encode()).hexdigest()
    assert (p.stat().st_mode & 0o777) == 0o640
    assert os.listdir(tmp_path) == ["f.xml"]


def test_write_conflict(tmp_path):
    p = tmp_path / "f.xml"
    p.write_bytes(b"<root/>")
    with pytest.raises(files.Conflict) as e:
        files.write_tree(str(p), "<new/>", "0" * 64)
    assert e.value.current_sha == hashlib.sha256(b"<root/>").hexdigest()
    assert p.read_bytes() == b"<root/>"
