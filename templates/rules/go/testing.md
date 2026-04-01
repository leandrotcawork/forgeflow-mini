# Go Testing

## Framework
- Standard library `testing` package
- Table-driven tests with `t.Run` for subtests

## Test File Placement
- Same package: `foo_test.go` alongside `foo.go`
- Black-box tests: `package foo_test`

## Test Naming
- Functions: `TestFunctionName`, `TestTypeName_MethodName`
- Subtests: descriptive strings in `t.Run("scenario name", ...)`
- Benchmarks: `BenchmarkFunctionName`

## Table-Driven Pattern
```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, got, tt.expected)
            }
        })
    }
}
```

## Coverage
- Baseline: 80% for new packages
- Every exported function must have at least one test
- Test error paths, not just happy paths

## TDD Steps
1. Write `TestXxx` with a clear expectation
2. Run: `go test ./... -run TestXxx` — expect FAIL
3. Implement minimal code to pass
4. Run: `go test ./...` — expect PASS
5. Commit
