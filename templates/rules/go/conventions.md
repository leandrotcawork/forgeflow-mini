# Go Conventions

## Naming
- Packages: short, lowercase, no underscores (`httputil`, not `http_util`)
- Exported: PascalCase (`UserService`, `GetUser`)
- Unexported: camelCase (`userService`, `getUser`)
- Constants: PascalCase for exported, camelCase for unexported
- Errors: `ErrXxx` for sentinel errors, `XxxError` for types

## Package Structure
- One package per directory
- `internal/` for non-exported packages
- `cmd/` for main packages
- Keep packages small and focused

## Error Handling
- Return errors, don't panic in library code
- Wrap errors with context: `fmt.Errorf("doing X: %w", err)`
- Handle every error; never `_ = err`
- Use `errors.Is` / `errors.As` for error inspection

## Patterns
- Interfaces at point of use, not definition
- Accept interfaces, return concrete types
- Dependency injection via constructor functions
- Table-driven tests with `t.Run` subtests

## Formatting
- Always run `gofmt` or `goimports`
- Never commit unformatted code
