# Python Testing

## Framework
- pytest (not unittest)
- pytest-cov for coverage reporting

## Test File Placement
- `tests/` directory at project root
- Mirror source structure: `src/foo/bar.py` → `tests/foo/test_bar.py`
- Prefix test files with `test_`

## Test Naming
- Functions: `test_<what>_<condition>` (e.g., `test_add_positive_numbers`)
- Classes: `TestClassName` (group related tests)

## Fixture Pattern
```python
import pytest

@pytest.fixture
def user():
    return User(name="Alice", email="alice@example.com")

def test_user_has_name(user):
    assert user.name == "Alice"
```

## Parametrize Pattern
```python
@pytest.mark.parametrize("a,b,expected", [
    (1, 2, 3),
    (-1, -2, -3),
    (0, 0, 0),
])
def test_add(a, b, expected):
    assert add(a, b) == expected
```

## Coverage
- Baseline: 80% for new modules
- Test error paths and edge cases, not just happy paths
- Use `pytest --cov=src --cov-report=term-missing`

## TDD Steps
1. Write `test_<behavior>` with a clear assertion
2. Run: `pytest tests/test_foo.py::test_behavior -v` — expect FAIL
3. Implement minimal code to pass
4. Run: `pytest` — expect PASS
5. Commit
