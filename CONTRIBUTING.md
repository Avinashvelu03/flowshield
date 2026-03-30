# Contributing to FlowShield

Thank you for your interest in contributing to FlowShield! 🎉

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Avinashvelu03/flowshield.git
cd flowshield

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Build
npm run build
```

## Guidelines

### Code Quality
- All code must be written in TypeScript with strict mode.
- Maintain 100% test coverage — every new feature must include tests.
- No external dependencies — FlowShield is zero-dependency by design.

### Pull Requests
1. Fork the repository and create a feature branch.
2. Write tests for any new functionality.
3. Ensure all tests pass with 100% coverage: `npm run test:coverage`
4. Ensure the build succeeds: `npm run build`
5. Ensure type checking passes: `npm run typecheck`
6. Submit a pull request with a clear description.

### Commit Messages
Use conventional commit format:
- `feat: add new policy`
- `fix: resolve edge case in retry`
- `test: add coverage for circuit breaker`
- `docs: update README`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
