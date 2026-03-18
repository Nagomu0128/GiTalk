variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

variable "app_name" {
  type    = string
  default = "gjh"
}

variable "github_owner" {
  type        = string
  description = "GitHub repository owner"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name"
}

variable "firebase_project_id" {
  type        = string
  description = "Firebase project ID"
  default     = "gitalk-01100128"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = null
}
