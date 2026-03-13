output "backend_url" {
  value = module.cloud_run_backend.service_url
}

output "artifact_registry_url" {
  value = module.artifact_registry.repository_url
}

output "cloud_sql_connection_name" {
  value = module.cloud_sql.connection_name
}

output "storage_bucket" {
  value = module.cloud_storage.bucket_name
}
