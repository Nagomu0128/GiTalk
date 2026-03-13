resource "google_sql_database_instance" "this" {
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region

  settings {
    tier              = var.tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = false

    ip_configuration {
      ipv4_enabled = var.enable_public_ip

      dynamic "authorized_networks" {
        for_each = var.authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.cidr
        }
      }
    }

    backup_configuration {
      enabled                        = var.enable_backup
      point_in_time_recovery_enabled = false
      transaction_log_retention_days = var.enable_backup ? 1 : null
      backup_retention_settings {
        retained_backups = var.enable_backup ? 3 : 0
      }
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }
  }

  deletion_protection = var.deletion_protection
}

resource "google_sql_database" "this" {
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "this" {
  count    = var.user_name != null ? 1 : 0
  name     = var.user_name
  instance = google_sql_database_instance.this.name
  password = var.user_password
}
