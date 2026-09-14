import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const itemshelf = github("hamashou74/itemshelf", {
    branch: "master",
    checkSuites: true,
  });

  const Postgres = postgres("Postgres", { region: "sfo" });
  const postgresVolume = volume("postgres-volume", {
    region: "sfo",
    sizeMB: 500,
  });

  const backend = service("backend", {
    source: itemshelf,
    build: {
      builder: "DOCKERFILE",
      watchPatterns: ["/backend/**", "/.dockerignore"],
      buildEnvironment: "V3",
      dockerfilePath: "/backend/Dockerfile",
    },
    healthcheck: "/api/health",
    preDeploy: "python manage.py migrate --noinput",
    replicas: { sfo: 1 },
    env: {
      DATABASE_URL: preserve(),
      DJANGO_ALLOWED_HOSTS: preserve(),
      DJANGO_SECRET_KEY: preserve(),
      DJANGO_SETTINGS_MODULE: preserve(),
    },
  });

  const frontend = service("frontend", {
    source: itemshelf,
    build: {
      builder: "DOCKERFILE",
      watchPatterns: ["/frontend/**", "/backend/schema.yaml", "/.dockerignore"],
      buildEnvironment: "V3",
      dockerfilePath: "/frontend/Dockerfile",
    },
    healthcheck: "/health",
    replicas: { sfo: 1 },
    env: {
      API_TIMEOUT_MS: preserve(),
      BACKEND_API_ORIGIN: preserve(),
      SESSION_SECRET: preserve(),
    },
  });

  return project("Itemshelf", {
    resources: [Postgres, postgresVolume, backend, frontend],
  });
});
