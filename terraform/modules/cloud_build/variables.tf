variable "trigger_name" {
  type = string
}

variable "region" {
  type = string
}

variable "connection_region" {
  type        = string
  description = "Region for the Cloud Build GitHub connection"
}

variable "connection_name" {
  type        = string
  description = "Name of the existing Cloud Build GitHub connection"
}

variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "project_number" {
  type        = string
  description = "GCP project number"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "branch_pattern" {
  type    = string
  default = "^main$"
}

variable "artifact_registry_url" {
  type = string
}

variable "image_name" {
  type = string
}

variable "dockerfile_path" {
  type    = string
  default = "Dockerfile"
}

variable "build_context" {
  type    = string
  default = "."
}

variable "cloud_run_service_name" {
  type = string
}
