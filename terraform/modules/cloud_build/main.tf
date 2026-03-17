resource "google_cloudbuildv2_repository" "this" {
  location          = var.connection_region
  name              = var.github_repo
  parent_connection = "projects/${var.project_id}/locations/${var.connection_region}/connections/${var.connection_name}"
  remote_uri        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
}

resource "google_cloudbuild_trigger" "this" {
  name            = var.trigger_name
  location        = var.connection_region
  service_account = "projects/${var.project_id}/serviceAccounts/${var.project_number}-compute@developer.gserviceaccount.com"

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
