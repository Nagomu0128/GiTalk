resource "google_storage_bucket" "this" {
  name     = var.bucket_name
  location = var.location

  storage_class               = var.storage_class
  uniform_bucket_level_access = true
  force_destroy               = var.force_destroy

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_age_days != null ? [1] : []
    content {
      condition {
        age = var.lifecycle_age_days
      }
      action {
        type = "Delete"
      }
    }
  }

  dynamic "cors" {
    for_each = var.cors_origins != null ? [1] : []
    content {
      origin          = var.cors_origins
      method          = ["GET", "HEAD", "PUT", "POST"]
      response_header = ["*"]
      max_age_seconds = 3600
    }
  }
}

resource "google_storage_bucket_iam_member" "members" {
  for_each = { for m in var.iam_members : "${m.role}-${m.member}" => m }
  bucket   = google_storage_bucket.this.name
  role     = each.value.role
  member   = each.value.member
}
