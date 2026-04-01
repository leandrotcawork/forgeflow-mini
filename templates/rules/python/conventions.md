# Python Conventions

## Naming
- Modules and packages: `snake_case`
- Classes: `PascalCase`
- Functions and variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private: prefix with `_` (single underscore)

## Module Structure
- One module per file, focused responsibility
- `__init__.py` exports public API only
- Use absolute imports (not relative)

## Type Hints
- Required for all function signatures
- Use `Optional[X]` or `X | None` (Python 3.10+)
- Use `TypedDict` for dict shapes
- Run `mypy` in strict mode for new code

## Error Handling
- Raise specific exceptions, not bare `Exception`
- Create custom exception classes for domain errors
- Never silence exceptions with bare `except: pass`

## Patterns
- Dataclasses or Pydantic for data containers
- Dependency injection via constructor arguments
- Context managers for resource cleanup
- Generator functions for lazy sequences

## Formatting
- Use `ruff` for formatting and linting
- Line length: 88 (black default)
- Never commit code that fails `ruff check`
