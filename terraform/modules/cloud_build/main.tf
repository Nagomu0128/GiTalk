resource "google_service_account" "cloudbuild" {
  account_id   = "${var.trigger_name}-cb"
  display_name = "Cloud Build Service Account for ${var.trigger_name}"
}

resource "google_project_iam_member" "cloudbuild_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

resource "google_project_iam_member" "cloudbuild_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

resource "google_project_iam_member" "cloudbuild_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

resource "google_cloudbuildv2_repository" "this" {
  location          = var.connection_region
  name              = var.github_repo
  parent_connection = "projects/${var.project_id}/locations/${var.connection_region}/connections/${var.connection_name}"
  remote_uri        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
}

resource "google_cloudbuild_trigger" "this" {
  name            = var.trigger_name
  location        = var.connection_region
  service_account = google_service_account.cloudbuild.id

  repository_event_config {
    repository = google_cloudbuildv2_repository.this.id
    push {
      branch = var.branch_pattern
    }
  }

  filename = "cloudbuild.yaml"

  substitutions = {
    _ARTIFACT_REGISTRY_URL = var.artifact_registry_url
    _IMAGE_NAME            = var.image_name
    _CLOUD_RUN_SERVICE     = var.cloud_run_service_name
    _REGION                = var.region
  }
}
