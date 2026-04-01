# TypeScript + React Conventions

## Naming
- Components: `PascalCase` (`UserCard`, `LoginForm`)
- Hooks: `useCamelCase` (`useUserData`, `useFormState`)
- Utilities: `camelCase` (`formatDate`, `parseError`)
- Types/Interfaces: `PascalCase` (`UserProps`, `ApiResponse`)
- Constants: `UPPER_SNAKE_CASE` or `PascalCase` for objects

## Component Structure
- One component per file
- Props type defined inline or in same file
- Default export for main component; named exports for utilities

## TypeScript Rules
- No `any` — use `unknown` if type is truly unknown
- Prefer `interface` for object shapes, `type` for unions/intersections
- Avoid non-null assertion `!` — handle null explicitly
- `strict: true` in tsconfig

## Patterns
- Functional components only (no class components)
- Custom hooks for reusable stateful logic
- Context for cross-cutting state (not prop drilling 3+ levels)
- Server components by default in Next.js (use `"use client"` only when needed)

## Imports
- Absolute imports via `@/` alias (preferred)
- Group: external libs, then internal, then relative
- No circular imports

## Formatting
- Prettier for formatting, ESLint for linting
- Never commit code that fails `eslint` or `tsc --noEmit`
