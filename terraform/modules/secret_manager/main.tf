resource "google_secret_manager_secret" "this" {
  secret_id = var.secret_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "this" {
  count       = var.secret_data != null ? 1 : 0
  secret      = google_secret_manager_secret.this.id
  secret_data = var.secret_data
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = toset(var.accessor_members)
  secret_id = google_secret_manager_secret.this.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value
}
