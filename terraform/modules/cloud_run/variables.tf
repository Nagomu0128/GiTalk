variable "service_name" {
  type = string
}

variable "region" {
  type = string
}

variable "image" {
  type = string
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "max_instance_count" {
  type    = number
  default = 2
}

variable "env_vars" {
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "secret_env_vars" {
  type = list(object({
    name      = string
    secret_id = string
    version   = string
  }))
  default = []
}

variable "cloud_sql_instance" {
  type    = string
  default = null
}

variable "service_account_email" {
  type    = string
  default = null
}

variable "allow_unauthenticated" {
  type    = bool
  default = false
}
