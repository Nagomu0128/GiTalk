resource "google_cloudbuildv2_repository" "this" {
  location          = var.connection_region
  name              = var.github_repo
  parent_connection = "projects/${var.project_id}/locations/${var.connection_region}/connections/${var.connection_name}"
  remote_uri        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
}

resource "google_cloudbuild_trigger" "this" {
  name     = var.trigger_name
  location = var.connection_region

  service_account = "projects/${var.project_id}/serviceAccounts/${var.project_number}@cloudbuild.gserviceaccount.com"

  repository_event_config {
    repository = google_cloudbuildv2_repository.this.id
    push {
      branch = var.branch_pattern
    }
  }

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-t", "${var.artifact_registry_url}/${var.image_name}:$COMMIT_SHA",
        "-t", "${var.artifact_registry_url}/${var.image_name}:latest",
        "-f", var.dockerfile_path,
        var.build_context,
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "--all-tags",
        "${var.artifact_registry_url}/${var.image_name}",
      ]
    }

    step {
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "run", "deploy", var.cloud_run_service_name,
        "--image", "${var.artifact_registry_url}/${var.image_name}:$COMMIT_SHA",
        "--region", var.region,
      ]
    }

    images = [
      "${var.artifact_registry_url}/${var.image_name}",
    ]
  }
}
