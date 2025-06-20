# Development Guidelines

## Code Quality Commands

When making changes to the codebase, please run these commands to ensure code quality:

### Linting

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck
```

### Run All Validations

```bash
# Run all checks (type checking, linting, and formatting)
npm run validate
```

## Pre-commit Hooks

The repository has pre-commit hooks configured that will automatically:

- Run ESLint on staged files
- Format staged files with Prettier

These will run automatically when you commit, but you can also run the checks manually before committing.

## IDE Setup

For the best development experience, install the recommended VS Code extensions:

- Astro
- ESLint
- Prettier
- TypeScript

The workspace settings are already configured to format on save and apply linting fixes.
