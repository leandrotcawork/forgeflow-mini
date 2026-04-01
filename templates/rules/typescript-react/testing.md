# TypeScript + React Testing

## Framework
- Vitest for unit and integration tests
- React Testing Library (RTL) for component tests
- No Enzyme, no shallow rendering

## Test File Placement
- Co-located: `Foo.test.tsx` next to `Foo.tsx`
- Or: `__tests__/Foo.test.tsx` in same directory

## Test Naming
- `describe('ComponentName', () => { it('should behavior', ...) })`
- Describe blocks for component grouping
- `it` or `test` for individual cases

## RTL Pattern
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserCard } from './UserCard'

describe('UserCard', () => {
  it('should display the user name', () => {
    render(<UserCard name="Alice" email="alice@example.com" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<UserCard name="Alice" email="alice@example.com" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

## Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from './useCounter'

it('should increment count', () => {
  const { result } = renderHook(() => useCounter())
  act(() => { result.current.increment() })
  expect(result.current.count).toBe(1)
})
```

## Coverage
- Baseline: 80% for new components and hooks
- Test user interactions, not implementation details
- Prefer `getByRole` and `getByLabelText` over `getByTestId`

## TDD Steps
1. Write `it('should <behavior>', ...)` with RTL assertions
2. Run: `vitest run --reporter=verbose` — expect FAIL
3. Implement minimal component/hook to pass
4. Run: `vitest run` — expect PASS
5. Commit
