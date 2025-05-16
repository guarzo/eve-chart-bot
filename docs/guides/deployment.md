# Deployment Guide

This document outlines the CI/CD pipeline and deployment process for the EVE Chart Bot.

## GitHub Workflow

The project uses GitHub Actions for continuous integration and deployment. The workflow is defined in `.github/workflows/ci-cd.yml`.

### Workflow Stages

1. **Test Application**: Runs whenever code is pushed to the main branch or when a pull request is created.

   - Sets up Node.js environment
   - Installs dependencies
   - Runs database migrations
   - Executes test suite

2. **Build and Test Docker Image**: Runs after tests pass successfully.

   - Builds a Docker image using the Dockerfile
   - Tests that the image can run successfully

3. **Create Release and Deploy**: Only runs when a tag with format `v*` (e.g., `v1.0.0`) is pushed.
   - Logs in to Docker Hub using secrets
   - Builds and pushes the Docker image with appropriate tags
   - Creates a GitHub release

## Manual Deployment

### Prerequisites

- Docker and Docker Compose installed
- Access to Docker Hub account

### Deploy using Docker

```bash
# Pull the latest image
docker pull yourrepo/eve-chart-bot:latest

# Run the container
docker run -d \
  --name eve-chart-bot \
  -e DATABASE_URL=postgresql://user:password@host:port/database \
  -e REDIS_URL=redis://host:port \
  -e OTHER_ENV_VARS=values \
  yourrepo/eve-chart-bot:latest
```

## Setting Up GitHub Secrets

For the workflow to function properly, you need to set up the following secrets in your GitHub repository:

1. `DOCKER_HUB_USERNAME`: Your Docker Hub username
2. `DOCKER_HUB_TOKEN`: Your Docker Hub access token (not your password)

To add these secrets:

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add the secrets mentioned above

## Creating a Release

To create a new release and deploy to Docker Hub:

1. Make sure all your changes are committed and pushed to the main branch
2. Create and push a new tag with semantic versioning:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the workflow which will:

- Run tests
- Build the Docker image
- Push the image to Docker Hub with tags:
  - `latest`
  - The full version (e.g., `1.0.0`)
  - The major.minor version (e.g., `1.0`)
- Create a GitHub release with auto-generated release notes

## Troubleshooting

If you encounter issues with the workflow:

1. Check the GitHub Actions logs for detailed error messages
2. Verify that all required secrets are correctly set up
3. Ensure your Dockerfile is properly configured
4. Check that your tests are passing locally
