output "instance_name" {
  value = google_sql_database_instance.this.name
}

output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "public_ip" {
  value = google_sql_database_instance.this.public_ip_address
}

output "private_ip" {
  value = google_sql_database_instance.this.private_ip_address
}

output "database_name" {
  value = google_sql_database.this.name
}
