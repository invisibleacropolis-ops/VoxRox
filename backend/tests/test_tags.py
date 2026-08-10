from voxrox import tags


def test_all_tokens_are_bracketed_and_unique():
    tokens = [tag.token for group in tags.TAG_GROUPS for tag in group.tags]
    assert len(tokens) == len(set(tokens))
    assert all(t.startswith("[") and t.endswith("]") for t in tokens)


def test_known_tokens_include_the_documented_vocabulary():
    assert "[laughter]" in tags.ALL_TOKENS
    assert "[sigh]" in tags.ALL_TOKENS
    assert "[dissatisfaction-hnn]" in tags.ALL_TOKENS
    assert "[surprise-wa]" in tags.ALL_TOKENS
    assert len(tags.ALL_TOKENS) == 13


def test_extract_tags_finds_tokens_in_order_with_duplicates():
    text = "Well [sigh] fine. [laughter] Really? [laughter]"
    assert tags.extract_tags(text) == ["[sigh]", "[laughter]", "[laughter]"]


def test_extract_tags_ignores_pronunciation_brackets():
    assert tags.extract_tags("the [B EY1 S] guitar") == []


def test_unknown_tags_reports_only_lowercase_hyphen_tokens():
    text = "hi [laughter] [wobble] [B EY1 S]"
    assert tags.unknown_tags(text) == ["[wobble]"]


def test_strip_tags_removes_tokens_and_collapses_spaces():
    assert tags.strip_tags("Hey [laughter] there") == "Hey there"


def test_group_ids_are_unique():
    ids = [group.id for group in tags.TAG_GROUPS]
    assert len(ids) == len(set(ids))
