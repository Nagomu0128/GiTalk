resource "google_cloudbuild_trigger" "this" {
  name     = var.trigger_name
  location = var.region

  github {
    owner = var.github_owner
    name  = var.github_repo

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
