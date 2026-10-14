# Project RiverGuard Branch Strategy

## Main Branches
- `main`: Stable project version.
- `develop`: Integration and testing branch.

## Feature Branches
Create feature branches from `develop` for individual tasks.

- `feature/frontend`
- `feature/backend-api`
- `feature/robot-mqtt`
- `feature/ai-processing`

## Workflow
1. Create a feature branch from `develop`.
2. Commit changes to that branch.
3. Push the branch to GitHub.
4. Open a pull request into `develop`.
5. Review and test before merging.
6. Merge `develop` into `main` when the integrated project is stable.

## Rules
- Do not commit unfinished work directly to `main`.
- Never commit passwords, tokens, or secret `.env` files.
- Test changes before merging.
- Coordinate changes to shared files with teammates.