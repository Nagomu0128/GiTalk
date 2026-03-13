resource "google_artifact_registry_repository" "this" {
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = var.description

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"

    condition {
      older_than = "432000s" # 5 days
    }
  }
}
