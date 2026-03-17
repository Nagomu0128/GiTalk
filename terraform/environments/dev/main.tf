terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # TODO: Configure remote backend
  # backend "gcs" {
  #   bucket = "your-tfstate-bucket"
  #   prefix = "terraform/dev"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ============================================================
# Enable required APIs
# ============================================================
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ============================================================
# Service Account for Cloud Run
# ============================================================
resource "google_service_account" "backend" {
  account_id   = "${var.app_name}-backend"
  display_name = "Cloud Run Backend Service Account"
}

# ============================================================
# Artifact Registry
# ============================================================
module "artifact_registry" {
  source = "../../modules/artifact_registry"

  region        = var.region
  repository_id = "${var.app_name}-repo"
  description   = "Docker images for ${var.app_name}"

  depends_on = [google_project_service.apis]
}

# ============================================================
# Cloud SQL
# ============================================================
module "cloud_sql" {
  source = "../../modules/cloud_sql"

  instance_name       = "${var.app_name}-db"
  region              = var.region
  database_version    = "POSTGRES_15"
  tier                = "db-f1-micro"
  disk_size_gb        = 10
  enable_public_ip    = true
  enable_backup       = false
  deletion_protection = false
  database_name       = var.app_name
  user_name           = "app"
  user_password       = var.db_password

  depends_on = [google_project_service.apis]
}

# ============================================================
# Secret Manager
# ============================================================
module "secret_database_url" {
  source = "../../modules/secret_manager"

  secret_id = "${var.app_name}-database-url"
  secret_data = var.db_password != null ? "postgresql://app:${var.db_password}@/${var.app_name}?host=/cloudsql/${module.cloud_sql.connection_name}" : null

  accessor_members = [
    "serviceAccount:${google_service_account.backend.email}",
  ]

  depends_on = [google_project_service.apis]
}

# ============================================================
# Cloud Storage
# ============================================================
module "cloud_storage" {
  source = "../../modules/cloud_storage"

  bucket_name = "${var.project_id}-${var.app_name}-assets"
  location    = var.region

  iam_members = [
    {
      role   = "roles/storage.objectViewer"
      member = "serviceAccount:${google_service_account.backend.email}"
    },
  ]

  depends_on = [google_project_service.apis]
}

# ============================================================
# Cloud Run (Backend)
# ============================================================
module "cloud_run_backend" {
  source = "../../modules/cloud_run"

  service_name = "${var.app_name}-backend"
  region       = var.region
  image        = "${module.artifact_registry.repository_url}/${var.app_name}-backend:latest"

  cpu                = "1"
  memory             = "512Mi"
  max_instance_count = 2
  container_port     = 8080

  env_vars = [
    { name = "NODE_ENV", value = "production" },
    { name = "GCS_BUCKET", value = module.cloud_storage.bucket_name },
  ]

  secret_env_vars = [
    {
      name      = "DATABASE_URL"
      secret_id = module.secret_database_url.secret_id
      version   = "latest"
    },
  ]

  cloud_sql_instance    = module.cloud_sql.connection_name
  service_account_email = google_service_account.backend.email
  allow_unauthenticated = true
  deletion_protection   = false

  depends_on = [google_project_service.apis]
}

# ============================================================
# Cloud Build
# ============================================================
module "cloud_build_backend" {
  source = "../../modules/cloud_build"

  trigger_name           = "${var.app_name}-backend-deploy"
  region                 = var.region
  connection_region      = "asia-northeast2"
  connection_name        = "gjh-hack-host"
  github_owner           = var.github_owner
  github_repo            = var.github_repo
  branch_pattern         = "^main$"
  artifact_registry_url  = module.artifact_registry.repository_url
  image_name             = "${var.app_name}-backend"
  dockerfile_path        = "backend/Dockerfile"
  build_context          = "backend"
  cloud_run_service_name = module.cloud_run_backend.service_name

  depends_on = [google_project_service.apis]
}
